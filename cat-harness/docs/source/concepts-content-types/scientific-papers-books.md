**Skill package:** `authoring-math` ·
**Adapter:** `paper` ·
**Guide:** [Writing a paper](https://litlfred.github.io/folio-assistant/folio-assistant-sci/guides/writing-a-paper.html)

Rigorous scientific papers and books where prose and mathematics are backed by a
machine-checked **Lean 4** formalization and rendered through **LaTeX**.

> **A paper is a document plus Lean-bearing blocks.** Everything in the section
> above applies here: the same block tree, the same editorial `uses[]` graph,
> the same QA sidecars, the same lifecycle — and the Markdown render path, which
> works while drafting on a machine with no TeX. The `paper` adapter *extends*
> the `document` adapter in code, for exactly that reason. What a paper adds is
> the seven kinds below whose assertion is a formal claim, and the two
> toolchains that check and typeset them.

- **Source model** — content is a tree of typed *blocks* (`definition`,
  `theorem`, `lemma`, `proof`, `equation`, `prose`, …). See the
  [TypeScript API reference]({{ '/api/' | relative_url }}) for `Block`, `Chapter`, and `Paper`.
- **Formalization** — `lean-formalization` and `proof-verification` skills drive
  Lean; each theorem-like block can be tracked against its Lean counterpart, and
  every `sorry` is auditable.
- **Rendering** — `latex-authoring` plus the paper adapter's
  `paper_render_pdf` / `paper_render_html` tools.

The seven kinds a document folio does **not** get, and the eight it shares:

| Block kind | Label prefix | Lean? | Profile |
|------------|-------------|-------|---------|
| `definition` | `def:` | **required** | paper only |
| `theorem` / `lemma` / `proposition` / `corollary` | `thm:` / `lem:` / … | expected | paper only |
| `conjecture` | `conj:` | optional | paper only |
| `proof` | `prf:` | optional | paper only |
| `example` / `remark` | `ex:` / `rem:` | optional | shared |
| `algorithm` / `simulator` | `alg:` / `sim:` | optional | shared |
| `prose` / `equation` / `diagram` / `table` | `prose:` / `eq:` / `fig:` / `tbl:` | n/a | shared |

The four `paper only` rows are `MATH_BLOCK_KINDS` in
[`schemas/block-kinds.ts`](https://github.com/litlfred/folio-assistant/blob/main/schemas/block-kinds.ts);
the `shared` rows are `DOCUMENT_BLOCK_KINDS`, derived as the complement so a
kind added later cannot go unclassified.

`definition` is the one kind whose `lean` field is *required* rather than
optional, so a document folio could not hold one even if the profile allowed
it. The `shared` kinds still *declare* an optional `lean`: the type permits what
the profile forbids, so `content_profile_check` has a second rule beyond "is
this kind allowed".

Relevant skill schemas:
[`latex-authoring`]({{ '/reference/skill-instructions/latex-authoring.html' | relative_url }}),
[`lean-formalization`]({{ '/reference/skill-instructions/lean-formalization.html' | relative_url }}),
[`proof-verification`]({{ '/reference/skill-instructions/proof-verification.html' | relative_url }}).

---
