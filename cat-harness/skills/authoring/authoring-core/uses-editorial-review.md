---
name: uses-editorial-review
description: >
  Adjudicate `uses-editorial-completeness` — read a block as a reader
  would and judge whether its `uses[]` is complete and genuinely
  expository.  The human/agent half of the `uses` QA axis; the
  mechanical half runs in `qa-checkers-uses.ts`.
allowed-tools: Read Edit Bash Grep Glob
---

# `uses[]` Editorial Review

## The relation you are auditing

`uses[]` is the **editorial** dependency relation: *what must a reader
have read to follow this block?* It is authored content — a deliberate
judgement about narrative order — and it is maintained by agents and
humans, not generated.

**The same relation exists at term scale**: a glossary term's `requires`,
and a schema term's `uses` in bootstrap's `graph.schema.json`, say what a
reader must know before the definition. Same discipline — AUTHORED, never
inferred, with a text matcher kept only as a guard that list and prose agree
(see the glossary ordering discipline, §"Ordered glossaries").

It is **not** any machine-derived dependency graph. A content type with a
formal layer also derives a formal relation, from what its proofs actually
invoke, and the two relations answer different questions and diverge in both
directions, correctly. The layer that ships such a content type holds that
comparison and names this skill from its side (for a paper folio, the science
layer).

## `interprets` is the same relation under a second field name

`uses[]` is the curated list. **`interprets` states the same reader-facing fact**
for a remark or example *about one specific block*, and the content graph counts
**both**.

Each editorial edge carries `editorialField` so a tool proposing an **edit** can
still tell which field an author wrote: **they are interchangeable to a reader
and not to a writer**, and collapsing them would make an automated edit
rewrite the wrong field.

**Two caveats, both of which change what a number means:**

- **`detangler-no-forward-ref` builds its own `uses`-only adjacency** and does
  not consume the shared graph, so forward-pointing `interprets` edges are
  outside what it counts.
- **The editorial graph is not acyclic.** Counting both fields reveals genuine
  editorial cycles. Do not "fix" one without reading whether it is real.

**Do not quote a count from prose — run the check against the corpus in front of
you.** A number in a document is a claim; only a run is evidence.

For impact questions — *what breaks if this changes?* — use the union, via the
content graph's accessors, which default to it.

## The prime directive

**Never populate `uses[]` from a machine-derived dependency graph.**
Copying derived dependencies in destroys the editorial signal and inflates
every ordering metric computed from it (graph energy, forward refs, cone
size, PageRank). Never "sync" the two.

When reviewing, do not open a block's formal or generated sibling to decide
what belongs in `uses[]`. The question is about the reader.

## Workflow

1. **Read the `.md` as a reader.** Cold. Do not read the `.ts` first —
   you want your own sense of what the block presumes before you see
   what the author declared.

2. **List what the narrative actually leans on.** Note every point
   where the prose:
   - uses notation it does not introduce,
   - names an object ("the canonical $X$") defined elsewhere,
   - argues *against* or *refines* a prior result,
   - presumes a construction the reader would otherwise have to
     reconstruct.

3. **Now read `uses[]`** in the `.ts` manifest and compare both ways.

4. **Judge completeness.** Anything from step 2 missing from `uses[]`
   that a reader would genuinely stumble over ⇒ **fail (major)**. A
   reader who could carry on unbothered ⇒ at most **warn**.

5. **Judge editorial fitness.** For each listed entry, ask: *would a
   reader be worse off having not read this first?*
   - Yes ⇒ fine.
   - No, and it looks like a derived artefact (an entry the prose never
     mentions, copied from a generated dependency list) ⇒ **fail
     (major)**. This is the pollution case.
   - No, but it is defensible context ⇒ **warn**.

6. **Write the sidecar entry** under `uses-editorial-completeness` with
   `reviewer.kind: "agent"` (or `"human"`), citing file:line and a
   verbatim quote for every finding — the block-QA evidence contract.

## Verdict rubric

| Verdict | When |
|---|---|
| `pass` | List reads as a deliberate editorial judgement; nothing a reader needs is missing; nothing present is dead weight. |
| `warn` | A marginal entry, or a missing dependency a reader could shrug off. |
| `fail` | A missing dependency a reader would stumble over, **or** an entry that is plainly a copied-in derived dependency. |

## Forward references and `foreshadows[]`

A `uses[]` entry pointing at a block that appears *later* in the chapter
is a `detangler-no-forward-ref` finding. Sometimes that is right — the
exposition really does defer — and `foreshadows[]` records it.

**`foreshadows[]` is independent of `uses[]`**, so a chapter overview can name
results it previews without asserting a dependency that is not real. It covers
two cases you must keep apart:

| case | in `uses[]`? | who records it | cost |
|---|---|---|---|
| **Pure forward pointer** — the prose names something coming later and does not depend on it | no | **derived** from the `.md`, not authored | zero by construction: it never enters the dependency graph |
| **Deferred prerequisite** — a real dependency the paper states later on purpose | yes | **declared** by the author, and only the author | exempt from ordering *cost*; still counted for cycles, cones and depth |

**Do not hand-author the first case.** `deriveForeshadows` reads the
block's own markdown links and backticked labels, keeps those that
resolve to a real block sitting later in reading order and are not
already in `uses[]`, and `loadChapterGraph` re-derives on every load.
Writing them into the manifest duplicates the prose into metadata, where it
goes stale.

The derivation never reads deferral *language*; it matches links and labels
only (phrasing detection misreads e.g. "**Below** $n^*$", a numeric
comparison).

## Declaring the second case

Only a deferred prerequisite needs your judgement: it exempts a real `uses[]`
edge from the ordering metrics, hiding a genuine defect behind an authored
claim that the disorder was intended, and nothing downstream re-opens it. The
contract in `BlockBase.foreshadows` is strict — the prose must **frame
the reference as deferred** ("we will need X, proved in chapter 9").

The bar is a first-person authorial hand-off that says the treatment
happens *elsewhere*: "we establish this in X", "we work this out
separately", "the derivation is recorded in X".

| Looks like a deferral | Actually |
|---|---|
| Bare cross-reference — "See [X] in Chapter 7" | `ordering`. Says nothing about direction. |
| Organizational pointer — "these tables are projections of this master table" | `ordering`. About structure, not sequence. |
| Block asserts the target's conclusion as background, then reasons onward from it | `ordering`. Consuming a result is the opposite of deferring it. |
| Target listed under "## Rigorous results" / "## Consumers / downstream" | `ordering` — and check the direction; these often run target→source. |
| A forward-looking word ("below", "later", "we must show") | `ordering` unless the sentence is about *this target's placement*. "Below $n^*$" is a numeric comparison; "we must show" is usually about research, not chapter order. |

Two failure modes survive a verbatim quote, so check both before
declaring:

- **False locator.** "the functor of the *next subsection*" where the
  target is 21 sections and ~300 blocks away. The prose defers; it does
  not defer *this far*, and the edge is a real defect.
- **Mis-aimed deferral.** The quoted sentence hands off to a *different*
  block than the edge under review. A deferral pointed elsewhere cannot
  exempt this one.

Both are about the *declared* case only. A derived pointer is aimed by
the link itself, so it cannot be mis-aimed, and it carries no exemption
to abuse.

Two rules police the field: `foreshadows-resolve` (every target must exist)
and `foreshadows-not-self`. The `foreshadows-point-forward` criterion catches
a target the reader has already passed, which is either a prerequisite
filed in the wrong field or an inert back-reference.

## A block's `uses[]` may be carrying the whole family

**Never judge an entry from the block's own `.md` alone.** A block is the head
of a family — `X-proof`, `X-interpretation`, `X-tableN-data` — and the
dependency you are looking for is often in a child while the *declaration* sits
on the parent.

- **Table children.** Pointer-style blocks ("See Table 3") keep their substance
  in `tbl:…-data`. A name-and-notation search of the parent's `.md` reports an
  absence that is not real.
- **Proof children.** A proof cites what the statement assumes. The parent's
  prose may never name a target its **proof child cites by label**; if the
  proof declares no `uses[]` of its own, the parent's entry is the **sole
  record** of the dependency, and deleting it as "unsupported by the prose"
  erases the edge entirely.

So before removing an entry, check whether any child leans on the target, and
whether that child declares anything itself. An entry that looks like dead
weight on the parent may be the family's only declaration.

Searching for the target's *words* also misses a lean on the target's *object*
— a source writing "the canonical $\tilde w_\lambda$" depends on whatever
defines the undeformed $w_\lambda$, whether or not it ever says so.

## Sibling parity is evidence only until a bulk edit touched the family

"All the siblings declare nothing, so declaring it here would be the anomaly"
is evidence only if no bulk operation has run over the family: a bulk edit (for
example a transitive-prune pass) produces parity **by construction**, so
parity cannot distinguish a shared convention from shared damage.

Before resting on it, check the **family's history**, not just the block's:

```sh
git log --oneline -- <chapter>/<sibling>.ts   # for two or three siblings
```

A convention shows up as blocks that were *authored* empty. Damage shows up as
one commit emptying all of them on the same day. If the emptiness has a single
commit behind it, parity tells you nothing about intent.

The same caution applies to any evidence drawn from what "the corpus does":
a corpus that has been swept is a record of the sweep as much as of the authors.

## One reading is not the standard

A single careful pass is not enough: on re-review, destructive `uses[]`
verdicts and foreshadow declarations are overturned often, and keyword search
over the `.md` alone misses real dependencies.

Use **two readers who cannot see each other's verdicts** for anything that
edits the graph, and treat agreement as the signal. Where they disagree, or
where either is unsure, leave the edge alone: a wrongly deleted editorial edge
silently corrupts every ordering metric computed from the graph.

**A retarget carries both burdens.** It asserts this edge is wrong *and* that
one is right, so it needs evidence for each half separately. When only the
second half holds, it is an **addition**, not a swap.

## Reading the mechanical findings first

Run the script half before adjudicating — it is cheap and it changes
what you should look at:

```sh
bun run pipeline/qa-checkers-uses.ts   # via qa-sweep --axis uses
```

| Mechanical finding | What it means for your review |
|---|---|
| `uses-editorial-hygiene` **fail** — unresolvable label | A dangling reference. Fix the label or add the missing block *before* judging completeness; the graph is wrong until you do. |
| `uses-editorial-hygiene` **warn** — transitive redundancy | Tidiness only. The graph is correct, just not minimal. Do not let it distract from the completeness question. |

A content type with a formal layer adds its own advisory finding here; the
layer that ships it says how to read it.

## Interaction with other skills

| Skill | Interaction |
|---|---|
| `content-graph` | Owns the graph the mechanical checks read |
| `prepare-merge` | Runs the `uses` axis as part of the content gates |

A content type's own skills that consume or extend this relation are named by
the layer that ships the type, which links down to this skill.
