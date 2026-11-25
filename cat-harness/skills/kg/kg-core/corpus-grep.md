---
name: corpus-grep
description: >
  Pre-declaration corpus check. Before declaring any item "open",
  "gap", "TODO", "open problem", "pending derivation" — or asserting
  in chat that something is unresolved in the corpus — run the
  four-path grep checklist. A source file's `## Status` note lags the
  corpus by weeks; the corpus is the source of truth. An item is open
  only after all four paths come back empty (modulo the originating
  file itself).
allowed-tools: Grep Glob Read Bash
---

# Corpus-Grep Skill

> **Disambiguation.** This skill formalizes the **backward** check
> ("has this already been resolved somewhere in the corpus?"). Its
> **forward** complement is the *formalize-first* discipline ("can a
> structural claim prune the hypothesis class before I run a wide
> search?"). Run corpus-grep before declaring an item open; run
> formalize-first before launching an expensive numerical scan. The
> two are duals — backward against known results, forward against the
> hypothesis class.

## Role

Gate every "this is open / unresolved / a gap" declaration behind a
mechanical four-path search of the corpus. The originating source
file's status note (`## Status`, `Open question`, `Phase 3 open`, a
`TODO` in a code or formal-source file, a PR-description "still open") is **not authoritative** —
prior agents routinely land a resolution as an audit doc, an adjacent
chapter's block, an implemented witness script, or a coordination
ledger entry *weeks before* the source file's note is updated. This
skill catches that lag.

## When to run this skill (STRICT)

Run the checklist **before** any of the following land in a durable
artifact (audit doc, content block `.md`/`.ts`, code or formal-source comment, PR
description, coordination ledger) **or** are asserted as fact in chat:

- "X is open" / "Open X" / "open problem" / "open question"
- "TODO: derive X" / "pending derivation" / "still missing"
- "this is a gap" / "no proof exists" / "not yet implemented"
- "X is not wired into compute" / "nothing computes X"

If you are about to type any of those about a corpus topic, stop and
run the four paths first.

## When NOT to run it (scope boundary)

The checklist gates **factual corpus-status claims** only. It does
**not** gate, and must never be used to suppress:

- **Skeptical assessments** — "this looks fitted", "this is
  numerology", "hidden degrees of freedom here".
- **Outside-view critique** of a derivation's rigor.
- **Reception / publishability / referee forecasts.**

Those are critical-distance judgments (see the repo's *Critical-distance
license*), not open-item declarations, and are never gated by this
skill. Voicing them in chat does **not** require running corpus-grep
first.

## The four-path checklist (run all four)

| # | Path | What it catches |
|---|------|-----------------|
| 1 | `grep -rln <topic> docs/audits/` | Owner-authorised resolutions land as audit docs ahead of the source file's status note being updated. |
| 2 | `grep -rln <topic> content/` (full tree) | Related conjectures / propositions cross-cut chapters: a block in one chapter may answer a question raised in another. |
| 3 | `grep -rln <topic> folio-assistant/computations/` | Implemented code may already discharge the content. |
| 4 | `docs/coordination/<theme>.md` | The coordination ledger — a prior agent may have already closed the item. |

**Search the full `content/` tree, not just the chapter you started
in.** The whole point of path 2 is that the resolution lives somewhere
you did not expect.

## Mechanical recipe

Pick a `TOPIC` that is the keyword / regex of the claim (an identifier,
a label fragment, a phrase — e.g. `delta_lambda`, `bring_color`,
`c_3.*Taylor`, `kashaev.*density`). Then run all four paths in one
sweep:

```bash
TOPIC='delta_lambda'   # ← keyword or regex for the claim under test
for d in docs/audits content folio-assistant/computations docs/coordination; do
  if [ -d "$d" ]; then
    echo "=== $d ==="
    grep -rln -e "$TOPIC" "$d" 2>/dev/null
  fi
done
```

Prefer the harness **Grep** tool (`output_mode: "files_with_matches"`,
one call per path or a single call with `path` set to the repo root and
a `glob`) over shell `grep` when running inside an agent — results
integrate with the permission UI and file links. The shell snippet
above is the portable fallback.

Widen the topic if the first pass is empty: try a synonym, the formal
declaration name, the block label, the function name, and the
witness-JSON key. A single spelling is not a clearing.

## Decision procedure

1. **Any non-trivial hit in (1)–(4)** ⇒ the item is **NOT** open.
   Read the hit, then *document the existing resolution* instead of
   declaring a gap. Cite the file (audit doc / block `.md` / witness /
   ledger entry) that resolves it.
2. **All four empty, modulo the originating file itself** ⇒ you may
   declare the item open. "Modulo the originating file" means: a hit
   that is only the source file you are auditing does not count as a
   clearing — it is the very note you already mistrust.
3. **Unsure whether a hit is the resolution** ⇒ open the file and
   read it. A filename match is a lead, not a verdict. Treat a hit as
   resolving only if it actually discharges the claim (an audit
   verdict, a proved block, a passing witness, a ledger "CLOSED").

## Where this discipline is codified (cross-references)

This skill is the canonical, self-contained statement. It is invoked
by, and consistent with, these codified instances:

- **The folio's own `AGENTS.md` or `CLAUDE.md`**, where it states the rule
  for its corpus.
- **A content type's own audits**, which apply the checklist to their
  declarations. For a paper folio these are the science layer's
  `proof-gap-audit` §K (proof-gap declarations), `compute-author` and
  `compute-audit` (before declaring a statement "not wired into compute")
  and `lean-environment-setup` (before declaring a capability unavailable).
