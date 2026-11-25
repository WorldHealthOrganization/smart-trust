---
name: upload-routes
description: >
  How a file actually REACHES `uploads/` — the two mechanisms that write bytes
  into a declared queue, the persona that performs one of them on somebody's
  behalf, and what each writer owes that the route does not do for them. The
  step before intake and after acquisition.
---

# Two mechanisms and a persona

[`content-acquisition`](content-acquisition.md) decides *what channel* a
resource comes in on — a file, a link, or a description somebody gives in
their own words. This skill starts one step later, where the answer was **a
file**: **what writes the bytes into the declared queue, and what does the
writer owe?**

It ends the moment the file is in the queue. [`uploads-watch`](uploads-watch.md)
notices it arrived; [`library-ingestion`](library-ingestion.md) and
`document-intake` take it from there.

## The answer is two, not three, and the third is a persona

Two mechanisms write bytes: a git commit, and the forge's web UI. A file handed
to an agent in a conversation is route 1 performed by a different actor. A
persona inherits every obligation of the mechanism it performs, so the question
about an agent is *"did the agent discharge the git route's obligations, and
what does it owe on top?"* Treating it as a third route would invite a third,
shorter list of obligations.

What it owes on top is provenance. A commit records its own author and message;
a web upload records the account that made it. Neither records *"this arrived
in a conversation, from this person, for this reason"* — that fact exists only
in the session, which is ephemeral. If the agent does not write it down when it
places the file, it is gone: for the other two routes a commit exists to go
back to, and for a conversation nothing does.

## Route 1 — a git commit from a working tree

`git add` the file under the queue, commit, push, open a PR.

A working tree is where the pre-commit hook and `bun run cat gates` run — if
you run them.

**What you owe.**

| | |
|---|---|
| put it in the **declared** queue of the layer that will own it | see §"Which queue" |
| run the generators the file stales | `uploads/README.md` is generated and lists **every file**, so any addition stales it. `bun run cat readme:subgraphs`, then `bun run cat gates` for the rest |
| open a PR | so CI judges it, and so a sibling session can see the queue grew |
| record where it came from | the commit message is the only place this route has for it |

**You do not owe ingestion.** Placing and ingesting are different acts by
different skills, and `uploads-watch` is explicit that a drop is somebody
handing over a file, not an instruction to publish it.

## Route 2 — the forge's web UI

GitHub's **"Add files via upload"**. Never write the URL by hand — run
`bun run cat-harness-tools/scripts/upload-url.ts [branch]`, which composes it from
the declaration. The declared path `uploads/` is relative to the *layer*,
and a forge URL needs it relative to the *repository*.

There is no working tree, so there is **no pre-commit hook and no generator
run**. The commit is minted server-side from the bytes you selected and nothing
else.

Two hazards:

- **It commits to the path you are LOOKING at.** A file outside the declared
  queue reads as absent to every consumer, because each resolves the queue from
  the declaration.
- **It lets you commit to any branch, including the default one.** A commit
  straight to `main` skips the PR, which is the only place CI would have run:
  no hook locally and no CI remotely. The generated `uploads/README.md` is then
  stale on the default branch, and `readme:subgraphs:check` — a blocking gate —
  fails for whoever opens the next pull request.

**What you owe.** Everything route 1 owes, discharged afterwards from a
checkout, because the web UI cannot discharge any of it:

1. choose the **branch**, not `main`, unless you are also going to run the
   generators immediately;
2. navigate to the **declared queue directory** before uploading, not to the
   repository root;
3. pull, run `bun run cat readme:subgraphs` and `bun run cat gates`, and push the
   result — or ask an agent to, which is the persona below.

## The persona — a file handed to an agent in a conversation

This is route 1, performed by an agent. It inherits every obligation above.
Three things are the agent's own:

**Materialise the bytes before anything else.** A file that exists only in the
conversation exists nowhere the repository can see. Write it into the declared
queue under a name that will still mean something — not
`ChatGPT Image Sep 20, 2026, 08_26_47 AM.png` or a bare UUID.

**Write down what the conversation knows and the commit does not** — who
provided it, when, what they said it was, and why it was wanted. Put it in the
commit message at minimum. This is the obligation the other two routes do not
have, and the reason the persona is named although it is not a mechanism.

**Do not ingest on your own say-so, and do not delete.** Both are other
skills' decisions — [`library-ingestion`](library-ingestion.md) and
[`deletion-requires-confirmation`](../../../skills/conduct/conduct-core/deletion-requires-confirmation.md). A
processed upload still looks spent and still is not.

## What the routes are NOT responsible for

The same three for every route, stated once so no route's section can shorten
the list:

- **deciding the file belongs in the corpus.** That is acquisition's question,
  answered before this step.
- **ingestion.** A file in the queue is a file in the queue; `library/` is a
  judgement call somebody else owns.
- **cleaning the queue.** `uploads/` is the raw record of what was handed over
  and a derived `library/` entry does not replace it.

## Which queue — there can be more than one, and they belong to different layers

A checkout that includes several layers can carry several `uploads` queues
— for example `uploads/` declared by the layer at the repository root and
`cat-harness/uploads/` declared by the `cat-harness` layer. They are not one
directory declared twice: they are two layers' queues that share an id.

So **"put it in `uploads/`" is not an instruction** — it does not say whose.
Resolve the queue from the declaration of the layer that will own the
material, which is what `queueRepoRelative` in `scripts/upload-url.ts` does and
what the `upload-url` Tool exposes. Pass that layer's root; do not paste a
path.

## Unsettled

- **Which layer owns a given file.** Nothing states the rule for choosing
  between two declared queues. Ask, or follow whatever the surrounding work
  already uses.
- **Whether an arrival without an intake record should be refused.** A gate
  would fail `main` on arrival, which is the opposite of accepting what
  somebody offers ([`content-acquisition`](content-acquisition.md)). Whether
  the record is owed by the placer or minted by intake is undecided.
