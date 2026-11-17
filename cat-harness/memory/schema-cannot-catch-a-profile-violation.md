---
$schema: folio-memory/v1
id: schema-cannot-catch-a-profile-violation
label: trap
summary: "the schema cannot catch a profile violation"
createdAt: 2026-09-19
roles:
  - code-reviewer
references:
  - kind: agent
    id: platform-boundary-guard
---
`pipeline/profile-check.ts` runs on every `content_validate` and
catches what **Zod structurally cannot**: a `theorem` is a valid `theorem`
whatever folio it sits in, and `constraints.ts` cannot read
`<name>.config.json`.

Two rules: kind-within-profile, and (document only) **no `lean` field and no
`.lean` sibling** — because `remark`, `example`, `algorithm` and `simulator`
all *declare* an optional `lean` that the type permits and the profile
forbids.
