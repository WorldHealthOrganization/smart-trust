---
# folio-assistant-bqrg
$schema: bean/1.0.0
title: stripLeanComments is implemented six times — converge on lean-lexer.ts
status: completed
type: task
priority: normal
created_at: 2026-09-18T22:52:21Z
updated_at: 2026-09-25T16:22:38Z
parent: folio-assistant-0lmb
---


## Measured 2026-09-18, on `claude/festive-galileo-s7ibx0`

```
grep -rn "stripLeanComments" --include=*.ts . | grep -v node_modules
```

Six independent implementations of a Lean comment stripper:

| file | line | shape |
|---|---|---|
| `content/pipeline/lean-lexer.ts` | 23 | **canonical** — extracted this session from `lean-atlas-ingest.ts` |
| `content/pipeline/qa-checkers-extended.ts` | 2925 | a local `const` inside a checker |
| `content/pipeline/qa-checkers-vacuity.ts` | 490 | a module-level `function`, used three times |
| `content/pipeline/conditional-class-banner-audit.ts` | 111 | a module-level `function` |
| `content/pipeline/qa-checkers-q-usage.ts` | 138 | a module-level `function`, plus its own `leanDeclSpans` |
| `scripts/lean-coverage.ts` | 177 | a module-level `function`, used twice |

`qa-checkers-q-usage.ts` also carries its own `leanDeclSpans` beside
`lean-lexer`'s `splitDeclarations`, so the *declaration splitter* has at least
two implementations as well.

## Why it matters, specifically

The canonical version's own doc comment states two invariants that a
reimplementation is unlikely to reproduce, and that nothing checks:

1. **Byte offsets are preserved.** Comment bodies are replaced with
   equal-length whitespace, because `splitDeclarations` indexes into the
   result and must stay aligned with the original source. A copy that simply
   deletes comments silently misaligns every span it feeds.
2. **Doc comments (`/-- … -/`) are comments.** A declaration name that appears
   only in prose is not a dependency; the canonical comment notes that skipping
   this is "how a scanner invents edges out of documentation".

Plus nested `/- … -/`, which the canonical one tracks with a depth counter.

## Why it was NOT done in the same change

Each copy feeds a QA checker, so a behavioural difference is a corpus-wide
re-sweep and a changed verdict on merged content. Some differences may be
deliberate — `qa-checkers-q-usage`'s, for instance, sits beside its own span
splitter and may rely on its exact output. Converging them blind is how a
"cleanup" becomes a silent re-scoring.

## Done when

Each of the five is either:

- **replaced** by `lean-lexer`'s, with the before/after verdicts compared on a
  real corpus and reported (not asserted); or
- **kept**, with a comment beside it saying what it does differently and why
  the canonical one will not do — which is a real answer, and the one that
  stops the next agent re-opening this.

A third state is expected and must not be collapsed into either: **no corpus
to compare against**. The platform carries no folio, so "the verdicts are
unchanged" is not checkable from this repo alone and must not be reported as
though it were.

## Context

Found while draining `content/pipeline/lean-signature.ts` → `lean-atlas-ingest.ts`,
the last of the core→sci edges in the repository-partition work. Extracting the
lexer to `content/pipeline/lean-lexer.ts` (classified core, by the same test as
`schemas/lean-packages.ts`) drained that edge and gave the five copies one home
to converge on.

## DONE 2026-09-20 — all five converged, with the corpus evidence this bean demanded

The bean warned that converging blind is how a cleanup becomes a silent
re-scoring, and named a third state — **no corpus to compare against** — that
must not be collapsed. There IS a corpus: qou's **3,954** `.lean` files, read
as test data.

### The comparison that mattered, and the one that did not

Raw output was the wrong axis: canonical BLANKS comments to preserve byte
offsets while every copy DELETED them, so raw output differed on 3,947 of
3,954 files — a design difference, not a behavioural one. Comparing the
**identifier set** each produced is what a downstream checker actually sees:

    impl        same token set   differs   verdict
    extended         3954           0      equivalent — depth counter
    coverage         3954           0      equivalent — depth counter
    vacuity          3950           4      NOT equivalent
    banner           3950           4      NOT equivalent
    qusage           3950           4      NOT equivalent

So this was never "five copies of one function". Two were faithful
reimplementations; **three were broken**.

### The defect in the three

All three used `/\/-[\s\S]*?-\//g`, which is non-greedy and matches to the
FIRST `-/`. Lean nests block comments, so an outer comment ends early and its
tail reaches the checker as code. Measured on
`confined-particle.lean` (nesting depth 2): **113 prose tokens** leaked —
`def`, `Prop`, `fun`, `True`, and English words including "docstring" and
"about" — into text three QA checkers scan for declarations. That is exactly
what `lean-lexer`'s own header warns of: *"how a scanner invents edges out of
documentation."*

### Before/after, REPORTED not asserted

Four files in the corpus strip differently now:

     113 tokens   knots-particles-confinement/confined-particle.lean
     117 tokens   lean/QOU/Interactions/AlgebraicPrimality.lean
      60 tokens   lean/QOU/HeckeAlgebra/JonesMarkovWenzl.lean
     328 tokens   scripts/lean/probes/prop-field-carrier-vacuity.lean

In every case the change REMOVES prose that was being read as code. Whether
any verdict flips is qou's to observe — this repository carries no folio, and
asserting "verdicts unchanged" from here is the thing the bean forbids. The
four files and the token counts are the handover.

### What landed

Five definitions deleted; all five sites import `lean-lexer`'s. One
implementation remains repo-wide. `check:partition` passes — `lean-lexer` is
core and `scripts/lean-coverage.ts` may import it.

7 tests, ratchet falsified (reintroducing a copy fails 1), plus the three
invariants a reimplementation kept losing: byte offsets preserved, nested
`/- /- -/ -/` closing in the right place, and doc comments counting as
comments.

### `leanDeclSpans` is NOT done

The bean also noted `qa-checkers-q-usage` carries its own declaration splitter
beside `lean-lexer`'s `splitDeclarations`. Untouched here — a span splitter's
output feeds offsets rather than a token set, so the same differential method
needs a different comparison, and bundling it would have made one change two.

## 2026-09-20 — the stripper half is DONE; the splitter half is measured and pinned

### `stripLeanComments`: converged and gated

All six call sites import from `content/pipeline/lean-lexer.js`. Nothing else
defines one. `scripts/tests/lean-lexer-is-the-only-stripper.test.ts` is the
ratchet — it scans for a second definition and fails on one — and it asserts
the two invariants the bean said a reimplementation was unlikely to reproduce:
byte offsets preserved (comment bodies become equal-length whitespace), and
`/-- … -/` doc comments treated as comments. 7 tests, passing.

### The splitter is NOT one duplicate, and that changes the task

`leanDeclSpans` (qa-checkers-q-usage) and `splitDeclarations` (lean-lexer)
answer **different questions**:

| | returns | for |
|---|---|---|
| `splitDeclarations` | `{name, signature, body, bodyAt}` — byte offsets | splitting a declaration into type and value |
| `leanDeclSpans` | `{name, start, end}` — 1-indexed inclusive LINE range | blanking everything outside a declaration while preserving line numbers |

Neither replaces the other and converging them would lose a projection. The
bean listed this as a second duplicate; it is not one.

### What IS duplicated: the pattern, and it has drifted four ways

`DECL_RE` (lean-lexer) vs `LEAN_DECL_RE` (q-usage), measured by running both
over named cases:

```
   axiom                lexer=[]           q-usage=["choice"]
   opaque               lexer=[]           q-usage=["secret"]
   unsafe def           lexer=[]           q-usage=["loop"]
   dotted name          lexer=["Foo.bar"]  q-usage=["Foo"]
   theorem/def/lemma/noncomputable/private/@[simp]/structure — AGREE
```

**Three are defects in `lean-lexer`**, and `axiom` is the sharp one:
`splitDeclarations` feeds `lean-signature.ts` and `lean-triviality-probe.ts`,
and in a formal corpus an axiom is the declaration whose presence most changes
what a proof is worth. A triviality probe that cannot see one is blind to
exactly what it exists to find. `unsafe` is worse than it looks — the modifier
list is `*`-repeated, so an unrecognised modifier makes the keyword fail to
match and the declaration is not seen at all.

**The fourth is a defect in q-usage**: its name class omits `.`, so
`theorem Foo.bar` yields a span named `Foo`. Its callers look a declaration up
by name and fall back to scanning the whole file when absent — so the truncation
silently triggers the fallback those callers exist to avoid.

### Why it is pinned rather than converged, and this is a hard blocker

The bean's own warning is right — every copy feeds a QA checker, so widening
either is a corpus-wide re-sweep and a changed verdict on merged content.

**And the sweep cannot be run here: this repository holds 0 `.lean` files.**
The platform carries no folio. So "just take the union" is not a judgement
call, it is an unmeasurable one, and shipping it would be precisely the silent
re-scoring the bean was opened to prevent.

`scripts/tests/lean-decl-regex-divergence.test.ts` pins all four differences by
name, importing both patterns rather than restating them — a test that re-types
the regex it tests stops testing it the first time either is edited, which is
the failure this whole bean is made of. It also asserts the seven cases where
they AGREE, so the table cannot be produced by one pattern matching nothing;
and it asserts this repo still has no `.lean` files, so the day a corpus lands
here the pinning fails and the sweep becomes possible.

## Done when

- [x] `stripLeanComments`: one implementation, gated.
- [x] The splitter's real duplication located: the pattern, not the functions.
- [x] The divergence measured, named, and pinned against silent drift.
- [x] One union pattern, with before/after verdicts on a real Lean corpus —
      `litlfred/qou`, and it was reachable from this container all along.

---

## DONE 2026-09-25 — the sweep ran, and the blocker was a checkout away

The previous round pinned the divergence rather than fixing it, on a stated
reason that was **half right**:

> **This repository holds 0 `.lean` files**, so the sweep cannot be run here at
> all; it has to happen in a folio that carries a Lean corpus.

The first clause is true — and is still asserted by a test, because it is worth
holding: this is the platform, and Lean content belongs to a folio. The
conclusion does not follow. The corpus is a **sibling checkout**, not a file in
this tree: `/home/user/qou`, **3,971** `.lean` files. And
`lean-lexer-is-the-only-stripper.test.ts`, in the same directory as the pin,
already recorded a **3,954-file** sweep run from a container exactly like this
one. The repository contained its own counter-example, and the pin's own text
said what to do when the sweep became possible: *"these tests should be replaced
by one union pattern plus its results."*

### The sweep — 3,971 files, 52,144 declarations

| pattern | found | wrong about |
|---|---|---|
| union (now `DECL_RE`) | 52,144 | — |
| `DECL_RE` before | 51,901 | **missed 243** across 105 files: `axiom` 113, `opaque` 130. No `unsafe` occurs in this corpus. |
| `LEAN_DECL_RE` | 52,144 | every name found, **990** of them (1.9%) truncated at the first dot |

**A missed keyword is not a skipped declaration.** `splitDeclarations` slices
from one start to the NEXT, so text it does not recognise is absorbed into the
body of whatever precedes it. Those 243 were reported as part of another
declaration's body, in authored content — `vertex-algebra-relations.lean`
absorbed **9** on its own — and `lean-triviality-probe` splices bodies. The
earlier round named the stake correctly: *"in a formal corpus an axiom is the
declaration whose presence most changes what a proof is worth."* 113 were
invisible.

### Two things the earlier analysis did not have

**The map collision.** With names truncated at the dot, every member of a
namespace collapsed to one `byName` key, so `new Map(...)` kept the **last**
while `find` returned the **first** — one name meaning two different spans
inside a single function. A body mentioning `AlgElement.add` pulled in whichever
member happened to be declared last, not the one referenced. Fixing only the
names would have made the closure reach *nothing*: quieter, no more correct. The
tokenizer speaks dots now too.

**The pattern has EIGHT sites, not two.** Found by the guard written for this
change. Five further modules carry their own, and every one is missing a keyword
the union has:

| module | misses |
|---|---|
| `conjectural-propagation-audit` | `example`, `inductive` |
| `generate-lean-stubs` | `axiom`, `example`, `opaque` |
| `proof-narrative-lean-equiv-sweep` | `example`, `opaque` |
| `qa-utils` | `example` |
| `lean-coverage` | `axiom`, `example`, `inductive`, `opaque` |

Three of the five miss `axiom` or `opaque` — the two that cost 243 declarations
above. **Not converged here**, for this bean's own reason: each feeds a different
consumer, so each is its own corpus re-sweep and its own changed verdict on
merged content. `lean-decl-starts-are-shared.test.ts` asserts the list by FILE
so it can only shrink; a sixth fails, and converging one lets somebody delete a
row.

### A separate defect this uncovered — bean `vrfx`

`stripLeanComments` writes a space over the **newlines** inside a block comment,
not just over its text. Length is preserved, which is the invariant the module
documents and tests; line count is not. Measured: **3,931 of 3,971 files (99.0%)
shift**, 281,234 lines lost, worst file −3,199. `qa-checkers-q-usage` states the
opposite in its own docblock, and `QUsageHit.line` is a number a reader is
shown.

Filed rather than fixed here, deliberately: the fix is one character, but it
moves a reader-facing line number on almost every file in a corpus, and folding
that into a splitter convergence is exactly the *"cleanup becomes a silent
re-scoring"* this bean warns about. `leanDeclSpans` is self-consistent either
way — it has always numbered the stripped text, which is also what
`scopeLeanToDecl` returns — so this change neither causes nor cures it.

### Verified

- both projections agree on names across all 3,971 files — **0 disagreements**
- 20 tests in `lean-decl-starts-are-shared.test.ts`, replacing the 12 that
  pinned the divergence
- `bun test` and the full `bun run cat gates` set
