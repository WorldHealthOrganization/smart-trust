---
name: flushable-containers
description: >
  A flushable container is a named store that accumulates by design — a trash
  you can recover from, a review preview, a console log. It declares a buffer
  limit, badges when over it, and offers three flush actions: flush all, trim to
  limit, and select to prune. What "flush" means, and which end of the order is
  expendable, are declared per container and differ.
allowed-tools: Read Grep Glob Bash AskUserQuestion
consulted: true
---

# Flushable containers

**A flushable container is a named store whose whole point is that it keeps
things.** A trash you can recover from, a review preview somebody has not looked
at yet, a console log you read back after a failure. The accumulation is the
feature, which is why none of them can be solved by simply not writing.

Three containers share the rule, which is why it is general rather than three
copies of one rule:

| container | what it holds | "flush" means |
|---|---|---|
| `fsh-guts` | deprecated pages, scripts, proposals — *"the trashcan that is kept"* | a **real, irreversible** delete. It is the last stop |
| staging previews | one built site per open branch, under `branches/<slug>/` on the publish branch | removal from the publish branch — **recoverable** by re-running Feature Staging |
| console log | what a run printed | truncation |

## Three actions, and they are not three wrappers on one

Each answers a different question, and a container that offers only one of them
is missing capability rather than keeping things simple.

1. **Flush all** — *"I do not need any of this."* One decision, whole container.
   The cheapest to build and the easiest to regret, so it is the one that most
   needs the confirmation rule below.
2. **Trim to limit** — *"keep what fits."* Mechanical, and it needs two things
   the container must declare: a **total order** and **which end is
   expendable**. See below — that end is not always the same.
3. **Select to prune** — *"I need to look first."* The only action that can
   spare an item a rule would have taken, which is exactly why it cannot be
   dropped as redundant. A rule that is right 95 % of the time still needs a
   way to be overruled on the other 5 %, and `select` is that way.

## The expendable end is declared, not assumed

**Trim-to-limit on previews and trim-to-limit on a console log discard opposite
ends, and this is the specialisation most likely to be got wrong.**

- A **preview** is most useful when newest. The oldest is the one nobody is
  reviewing any more, so trimming drops the oldest.
- A **console log** is often most useful at its *oldest* retained line, because
  the first error is the cause and everything after it is consequence. Dropping
  the oldest to make room is how a log keeps 10,000 lines of cascade and throws
  away the one line that explained it.

So a container declares which end trim takes. A shared `trim` that assumes
"drop oldest" is correct for two of the three cases here and silently wrong for
the third, and wrong in the direction that destroys the evidence.

## The badge has three states, and the third is not "fine"

Over-full is a **declared** state and gets a badge — **including the trash.** A
container you can recover from is the one whose size a reader stops thinking
about, so `fsh-guts` is the one that most needs the badge rather than the one
that needs it least: nothing else in the interface says it has grown, and the
whole premise of keeping deleted things is that nobody is watching them.

So does under. And so does **could not determine** — a container whose size
could not be read is not under its limit, it is unmeasured: *"'Could not read
gh-pages' is never '0 MB of previews'"*.

A badge that shows a number it could not obtain is worse than no badge, because
a reader acts on it.

## Never flush without explicit confirmation

This inherits
[`deletion-requires-confirmation.md`](../../conduct/conduct-core/deletion-requires-confirmation.md) whole:
an agent never removes a durable artefact on its own initiative, it reports what
would go — **with sizes and ages** — and waits to be told.

Two container-specific sharpenings:

- **`fsh-guts` is the strictest case in the system**, because it is where
  deletes already went. `AGENTS.md` makes "delete" mean "relocate to
  `fsh-guts`", which is what makes deletion reversible everywhere else —
  flushing `fsh-guts` is therefore the *only* truly irreversible delete, and the one
  confirmation that cannot be inferred from context.
- **Recoverability changes the bar, and it is the container's job to say so.** A
  staging preview is regenerable by re-running Feature Staging, so confirming
  its removal is a smaller decision than confirming a `fsh-guts` flush. A
  container that does not declare its recoverability forces every flush to be
  treated as the worst case, which is how a useful action becomes one nobody
  dares run.

## Liveness gates the prune, and "cannot tell" spares the item

An item can look dead and be live. A branch with no open PR may have been
committed to minutes ago by a session that reuses one branch across a run of
PRs: "no open PR" is not a synonym for "abandoned".

So a container declares its liveness signals, a prune candidate must fail
**every** one, and a signal that could not be evaluated **spares** the item
rather than condemning it. For previews those signals are `open-pr`,
`unmerged-branch` and `recent-commit` (30 minutes — the shortness is the point).

## A limit below the floor is not a limit, it is a permanent alarm

A limit must sit above its **floor** — concurrent users × item size. A limit
beneath its own floor cannot be satisfied, so it fires constantly, and a signal
that always fires becomes invisible. When the floor exceeds the limit, the
finding is about **item size or the limit**, never about pruning more
aggressively.

**When you look at item size, look for duplication before content.** Staging
previews built with an absolute `baseurl` of `/…/branches/<slug>` carry the slug
on every page, so git's content-hash deduplication shares nothing between them:
N previews store N copies of a site identical apart from its own address. **A
container over its limit is a question about the container, and "prune more"
is the one answer that never asks it.**

**But "make the references relative" is not the fix.** A reference is either
an **address** or a **name**, and only addresses may be relativized. A
stylesheet href is an address; a JSON-LD `@id` or a JSON Schema `$ref` is a
name, and a relative one resolves against the *retrieval* URL — so the graph's
identities become a function of how the file was fetched, and an out-of-band
validator has no base at all. Deduplication is not worth buying with identity;
identity references are left byte-for-byte alone, and what remains is a real
floor, answered by a limit whose **basis states it**.

## Adding a container

Declare, do not infer:

- **what it holds**, and whether the contents are recoverable and how;
- its **limit**, with a basis that names the floor;
- the **order** and **which end trim takes**;
- its **liveness signals**, and that an unevaluable signal spares;
- which of the three actions it offers, and what each does specifically.

## Not built yet

The **viewer** — a counter, an over-full badge and a select dialog — is separate
work: it is UI, and a select dialog must meet the accessibility rules. The
**staging** mechanism is a preflight plus a dispatchable cleanup path, because
a label-based remedy cannot reach the previews the check finds. This
skill is the concept those two implement, not a third implementation of it.
