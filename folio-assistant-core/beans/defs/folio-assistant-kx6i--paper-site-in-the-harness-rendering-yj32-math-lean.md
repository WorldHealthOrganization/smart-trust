---
# folio-assistant-kx6i
$schema: bean/1.0.0
title: 'PAPER SITE in the harness rendering (yj32): math, Lean links and notation macros, blocking qou''s legacy-render retirement'
status: completed
type: feature
priority: normal
created_at: 2026-10-04T15:10:09Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-yj32
---

Recorded from the qou work-plan analysis, 2026-10-04 (session https://claude.ai/code/session_01NdDGeP1SyShmoUssLuRZ91). Not started: recorded so the gap has an owner. qou cannot retire its legacy renderer until the harness-as-interface rendering handles a paper: KaTeX/MathJax with the folio's notation macros, block -> Lean declaration links, and the paper's block kinds.

## Owner ruling 2026-10-20 (from rehomed copy `cat-tools-og5t`): option 1, the declaration's source on GitHub

Asked in the drain coordinator's session (https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6): the owner chose **"GitHub source"**. A block's Lean declaration link goes to the declaration's line in its `.lean` file on GitHub, resolved from the block's `lean.ref` at the pinned commit. Built in `litlfred/cat-harness-tools#494` (`feat/og5t-lean-source-link`).

## Render check against qou in Chromium, 2026-10-21..2026-10-22 (`cat-tools-og5t`, `cat-harness-tools#551`)

- [x] Block → Lean declaration links resolved to GitHub source at the pinned commit (`cat-harness-tools#494`; verified in Chromium in `cat-harness-tools#551` by clicking `∀` on `bar-involution.lean#L40`, `jones-markov-trace.lean#L98`, `chi-sym-alt-closed-form.lean#L322` at commit `77e7f0e`)
- [x] Paper block kinds render (`remark`, `proposition`, `example`, `definition`, `theorem`, `conjecture`, `corollary`, `lemma`, `diagram`, `simulator`, `prose`, `proof`, `table`, `algorithm` — viewer bugs fixed in `cat-harness-tools#527` and `#532`)
- [x] Math typesetting verified in Chromium with KaTeX (`katex.min.js`, `katex.min.css`, `contrib/auto-render.min.js` served from `node_modules/katex`) and folio notation macros (`buildKatexMacros(p.macros)`): 6 sampled blocks (`def:bar-involution`: 9 `.katex`, `thm:jones-markov-trace`: 40, `prop:chi-sym-alt-closed-form`: 41, `tbl:hecke-log-decomposition-table-data`: 48, `alg:delta-lambda-closure`: 34, `rem:figure-eight-reeb-theta-value`: 59) rendered with 0 `.katex-error` (`cat-harness-tools#551`)
- [x] Lean badge and source panel rendering verified in Chromium (`#487` reads `lean.ref`, `#494` renders `"source on GitHub ↗"` in the Lean source panel opened from the block's `∀` indicator; `cat-tools-og5t` completed in `cat-harness-tools#551` `0eb0564210`)

## Rehomed 2026-10-10: this copy was a pointer

By the owner's ruling of 2026-10-10 (move to the code's repo, and keep a pointer here), this bean was re-filed in `litlfred/cat-harness-tools` as bean `cat-tools-og5t` (`cat-harness-tools#68`), which completed in `cat-harness-tools#551` (`0eb0564210`).


## Owner ruling 2026-10-20 (from rehomed copy `cat-tools-og5t`): option 1, the declaration's source on GitHub

Asked in the drain coordinator's session (https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6): the owner chose **"GitHub source"**. A block's Lean declaration link goes to the declaration's line in its `.lean` file on GitHub, resolved from the block's `lean.ref` at the pinned commit. Built in `litlfred/cat-harness-tools#494` (`feat/og5t-lean-source-link`).

## Render check against qou in Chromium, 2026-10-21..2026-10-22 (`cat-tools-og5t`, `cat-harness-tools#551`)

- [x] Block → Lean declaration links resolved to GitHub source at the pinned commit (`cat-harness-tools#494`; verified in Chromium in `cat-harness-tools#551` by clicking `∀` on `bar-involution.lean#L40`, `jones-markov-trace.lean#L98`, `chi-sym-alt-closed-form.lean#L322` at commit `77e7f0e`)
- [x] Paper block kinds render (`remark`, `proposition`, `example`, `definition`, `theorem`, `conjecture`, `corollary`, `lemma`, `diagram`, `simulator`, `prose`, `proof`, `table`, `algorithm` — viewer bugs fixed in `cat-harness-tools#527` and `#532`)
- [x] Math typesetting verified in Chromium with KaTeX (`katex.min.js`, `katex.min.css`, `contrib/auto-render.min.js` served from `node_modules/katex`) and folio notation macros (`buildKatexMacros(p.macros)`): 6 sampled blocks (`def:bar-involution`: 9 `.katex`, `thm:jones-markov-trace`: 40, `prop:chi-sym-alt-closed-form`: 41, `tbl:hecke-log-decomposition-table-data`: 48, `alg:delta-lambda-closure`: 34, `rem:figure-eight-reeb-theta-value`: 59) rendered with 0 `.katex-error` (`cat-harness-tools#551`)
- [x] Lean badge and source panel rendering verified in Chromium (`#487` reads `lean.ref`, `#494` renders `"source on GitHub ↗"` in the Lean source panel opened from the block's `∀` indicator; `cat-tools-og5t` completed in `cat-harness-tools#551` `0eb0564210`)


## Owner ruling 2026-10-20 (from rehomed copy `cat-tools-og5t`): option 1, the declaration's source on GitHub

Asked in the drain coordinator's session (https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6): the owner chose **"GitHub source"**. A block's Lean declaration link goes to the declaration's line in its `.lean` file on GitHub, resolved from the block's `lean.ref` at the pinned commit. Built in `litlfred/cat-harness-tools#494` (`feat/og5t-lean-source-link`).

## Render check against qou in Chromium, 2026-10-21..2026-10-22 (`cat-tools-og5t`, `cat-harness-tools#551`)

- [x] Block → Lean declaration links resolved to GitHub source at the pinned commit (`cat-harness-tools#494`; verified in Chromium in `cat-harness-tools#551` by clicking `∀` on `bar-involution.lean#L40`, `jones-markov-trace.lean#L98`, `chi-sym-alt-closed-form.lean#L322` at commit `77e7f0e`)
- [x] Paper block kinds render (`remark`, `proposition`, `example`, `definition`, `theorem`, `conjecture`, `corollary`, `lemma`, `diagram`, `simulator`, `prose`, `proof`, `table`, `algorithm` — viewer bugs fixed in `cat-harness-tools#527` and `#532`)
- [x] Math typesetting verified in Chromium with KaTeX (`katex.min.js`, `katex.min.css`, `contrib/auto-render.min.js` served from `node_modules/katex`) and folio notation macros (`buildKatexMacros(p.macros)`): 6 sampled blocks (`def:bar-involution`: 9 `.katex`, `thm:jones-markov-trace`: 40, `prop:chi-sym-alt-closed-form`: 41, `tbl:hecke-log-decomposition-table-data`: 48, `alg:delta-lambda-closure`: 34, `rem:figure-eight-reeb-theta-value`: 59) rendered with 0 `.katex-error` (`cat-harness-tools#551`)
- [x] Lean badge and source panel rendering verified in Chromium (`#487` reads `lean.ref`, `#494` renders `"source on GitHub ↗"` in the Lean source panel opened from the block's `∀` indicator; `cat-tools-og5t` completed in `cat-harness-tools#551` `0eb0564210`)
