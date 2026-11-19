---
name: opening-brief
description: >
  Brief a work item or a topic BEFORE touching anything: what you are doing and why
  it is worth doing, what you already know and with what provenance, how you
  plan to do it and what would falsify the approach. Scales with
  irreversibility, not line count.
allowed-tools: Read Grep Glob AskUserQuestion
---

# Opening brief — brief the topic before you touch anything

This skill governs what you say **before** the work;
`turn-reporting.md` (opt-in `cat-harness.sdlc`) governs what you say during and after
it; `todo-manager.md` (opt-in `cat-harness.work-plan`)
keeps the work item mechanics.

## Opening brief

**Claiming a work item records the work. Briefing it is what makes the work
resumable.** Both are required, and the brief comes first — before the first
tool call, in the chat, not in the commit.

AGENTS.md §"Opening a bean or a topic" states the rule and when it applies.
This is the shape.

### When it applies — proportionality, so this does not become ceremony

**The trigger is irreversibility and surprise, not line count.**

- **A one-line fix with an obvious route needs no brief.** Say what you are
  doing and do it.
- **Anything touching a shipped gate, a shared artefact, a formal declaration
  with consumers, or a number a reader sees — brief it.**
- **Anything where you expect to be wrong some of the time — brief it**, and say
  *where* you expect to be wrong. Research is the case this is most valuable for
  and most often skipped, on the grounds that the outcome is unknown. **The
  unknown outcome is the reason to write down the route**, not a reason to skip
  it.

### Why it is a rule and not a style preference

**Sessions end mid-thread.** Containers are reclaimed, context windows fill, a
branch is picked up days later by an agent with none of the reasoning that
produced it. The work item body and the commit are durable; the chain of inference
that made them sensible is not, unless it is written down at the point where it
was still obvious. An agent resuming cold should be able to read the brief and
continue — not reconstruct its predecessor's rabbit hole first.

**It catches wrong work before it is done rather than after.** A route stated in
advance can be corrected by the author in one line. The same route discovered in
a finished diff costs a review cycle and, often, a revert.

It is the same discipline as the question frame in
[`interaction-modality`](interaction-modality.md) §4.1, applied to work instead
of decisions: a terse start, like a terse question, makes the author go and
find context the agent already had.

### The four parts

**1. The problem, stated for someone who was not here.** Expand every
identifier on first use. Not "fixing `qou-93hu`" but "bean `qou-93hu` — the
`CriticalExponent` conjecture carrier, whose only field is `(3 * 4 : ℕ) = 12`, a
closed numeral identity with no exponent variable in it, so the class constrains
nothing."

**2. What you know, and how you know it.** Every number with its provenance:

| provenance | how to say it |
|---|---|
| measured this session, on this tree | "measured just now: 22 of 22 seeded, 0 missed" |
| measured this session, on a DIFFERENT tree | "grepped 0 on `claude/x` before branching — **not re-run here**" |
| carried from a prior session | "recorded 2026-08-24 as 43 drifted; not re-measured" |
| asserted by a work item or a doc | "bean `qou-q7lf` says X — **unverified**" |

The last row is the one that bites hardest. A sibling's work item is not a primary
source, and neither is a source file's `## Status` note; both go stale, and a
specific, recent, confidently-worded work item is exactly the kind that gets
believed.

**"Measured this session" is not the safe case.** A measurement is scoped to
the TREE it was taken on, and `git switch` invalidates every earlier one
without saying so. The number is real, recent, and yours; only the tree
underneath it moved. So say which tree, and re-run anything load-bearing after
a branch change — the re-run costs one command and it is the same command.

**Part 2 includes** the result of the collision review in
`coordinate` (opt-in `cat-harness.sdlc`) §"Starting new work": the siblings that overlap,
or "no overlap found" and what you checked.

**3. The route and the gate.** How you plan to do it, what you will verify
against, and **what would falsify the approach**. A plan with no failure mode is
not a plan; it is an intention. If the gate is a script, name it and its
expected output.

**4. What you are NOT doing.** The adjacent defect you are leaving, the scope
you decline to widen into, the thing you will flag rather than fix. Stating it
up front is what stops it becoming either silent scope creep or a silent
omission — and it puts the scope call where it can still be argued with, which
is before the diff.

### Briefing a sibling or a subagent — pass `interaction-modality` on (STRICT)

When a coordinating session writes a brief to launch a child session
(`create_session`, `send_message`) or a background subagent (`Agent`,
`invoke_subagent`), the brief is the child's only prompt until it reads the
graph. A child whose brief omits how to ask the owner will default to asking in
plain prose when it hits a permission wall or a design call.

Every sibling brief and subagent prompt written by a coordinating session MUST
carry the [`interaction-modality`](interaction-modality.md)
contract explicitly:

1. **If the child can reach the person directly** (a sibling session with its
   own chat surface): every question to the owner goes out **twice, in order**
   — first the full question in chat (context, what differs, every identifier
   expanded, at most four numbered or lettered options with pros, cons,
   downstream impact and reversibility, recommended option first and marked
   `(Recommended)`, and the stated default on silence), and second the tappable
   card (`AskUserQuestion`, `request_decision`, `ask_question`, or
   `post_widget`) carrying the same option labels. **Never ask in prose alone,
   and never ask the person to type.**
2. **If the child is a background subagent or a sibling running beside a live
   discussion**: it does not ask the person in prose either; it returns any
   owner-facing decision to the coordinating session in the
   [`hand-back-to-discussion`](hand-back-to-discussion.md)
   schema format so the coordinator presents both the full chat block and the
   tappable card.
3. **Pass it on**: if the child itself spawns a helper or a subagent, its brief
   to that child must carry the same `interaction-modality` block.

### Before you offer options, check whether it is already ruled (STRICT)

Part two of the brief is *what do I already know, with each measurement's
provenance*. This is the half that gets skipped, because an unsettled question
is more interesting than a settled one and nothing in a checkout announces that
a decision exists.

> **Presenting options for a settled question is worse than presenting none.**
> It reopens a decision, spends the owner's attention on it a second time, and
> the options offered will not be the ones already weighed.

Four places to look, in this order:

1. **The proposals — the design corpus.** They live in the `docs/` of the
   layer whose stub needs them; today that is
   `cat-harness/docs/proposals/` (opt-in `cat-harness.proposals`), and its
   `index.md` is where to start. **Resolve the directory rather than
   remembering this sentence** — a stub's `docs/` is where its proposals are,
   and this path is an example of the rule, not the rule.
2. **The owner's rulings**, in work items and in the declarations that quote them
   verbatim. A `_comment` field in a `*.json` is frequently where a decision
   was recorded, because that is where it had to be obeyed.
3. **The skill that owns the area** — and read it, rather than recalling it.
4. **The commit history** — `git log -S "<symbol>"` over the file you are
   about to change, and a `beans list | grep <topic>` that does **not** filter
   to open items. **A decision that shipped is invisible to every instrument
   that looks for pending ones** — and a recent one is exactly when you are
   most confident your own reading is current. One `git log -S` answers it.

**Cite what you read, never what you remember.** A half-remembered line used as
an authority is the fake-reference failure `activity-names-skill` exists to
prevent, one level up: it is unfalsifiable by the reader, because it sounds
like something this repository would say.

### Worked example

> **Starting `qou-93hu`** — the `CriticalExponent` §3b-cond hypothesis class in
> `lean/QOU/AlgebraicSubstrate/ConditionalClasses.lean`.
>
> **The problem.** Its single field is `alpha_three_eq_four : (3 * 4 : ℕ) = 12`
> — a closed numeral identity with the values already substituted in, so no
> exponent variable occurs in it and `rfl` proves it whatever the physics. Four
> sibling carriers in the same file are vacuous too, but they are at least the
> right *shape* (parameter-quantified inequalities); this one has no quantifier
> and no free variable at all.
>
> **What I know.** Measured this session: bound as `[C]` in 5 files; the probe
> baseline records it `proved-vacuous`; the class's own docstring already claims
> "α = 4/3", so the target value is not something I need to invent. Not
> measured: whether any downstream proof depends on the field's *current* type.
>
> **Route.** Make α a class parameter — `class CriticalExponent (α : ℝ) : Prop
> where alpha_eq : α = 4/3`. A `Prop` class cannot carry data, so α must be a
> parameter, not a field. Gate: lean-direct exit 0 on all three affected
> modules, plus a content probe proving `¬ CriticalExponent 2` — because
> inhabitability at 4/3 alone would not show the class constrains anything.
> **Falsifier:** if `¬ CriticalExponent 2` will not go through, the encoding is
> not doing what I claim and I stop.
>
> **Not doing.** The other four carriers need analytic setup their docstrings
> only gesture at — the author's mathematics, not a cleanup. Also leaving the
> separate `CriticalExponent` in `core-levi-form.lean`, a different carrier in a
> different namespace.

~200 words, and it would have let a reader stop the work, redirect it, or pick
it up cold.

### What a thin brief looks like, and why it fails

> Starting `qou-93hu` — fixing CriticalExponent.

Names the work item and nothing else. It does not say the field is a closed numeral
identity with no exponent variable in it, so a reader cannot tell whether this
is cosmetic or load-bearing; it does not say the class signature changes, so
nobody can warn that every binder in two consumer modules moves with it; and it
does not say what "fixed" will be checked against, so the agent is free to
declare victory on a compile. **Each of those omissions is a place the author
could have intervened for the cost of reading one sentence.**

### The failure this prevents

An agent that has spent an hour inside a problem writes in the private
vocabulary it built along the way, and a reader — the author, or the next agent
— has to reconstruct that vocabulary before evaluating anything. The brief is
written at the one moment when the agent still knows which parts are
non-obvious, because it has just finished finding them out.

**Cheapest correct move when you do not want to spend the words: do not start
the topic.** A task you cannot brief is one you have not understood well enough
to begin.

The brief's durable form is the PR description. Once the work exists,
`pr-description` (opt-in `cat-harness.sdlc`) answers the same questions for a
reader who arrives after it.
