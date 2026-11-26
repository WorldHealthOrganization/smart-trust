---
$schema: folio-memory/v1
id: the-top-level-is-four-things-and-three-are-memory
label: stable
summary: "top level = bootstrap/ + one dir per repo + beans/ todos/ fsh-guts/, which stay because they ARE the instance's memory"
createdAt: 2026-09-20
roles:
  - code-reviewer
references:
  - kind: agent
    id: platform-boundary-guard
---
Owner, 2026-09-20: the top level is *"the contents of repos"* except
`bootstrap/`, `beans/`, `todos/` and `fsh-guts/` — the last *"created in tooling
of cat-harness. keep it here (like beans and todos/) as this instance's own
working memory."*

**Memory is the reason, and it beats "never overlaid"** — a criterion two
readers answered differently about `fsh-guts/`. A repository has ONE memory
(`beans/` the agent's plan, `todos/` the person's items, `fsh-guts/` what was
discarded and kept), so it cannot be composed from parts. Never-overlaid is the
consequence.

**Tooling and store separate.** All three kinds are introduced by cat-harness;
the stores stay top-level. So "beans is a cat-harness concept" and "`beans/` is
not inside `cat-harness/`" are both true. `bootstrap/` introduces none — it is
read before any harness resolves. `scope: "repository"` means exactly these four.
