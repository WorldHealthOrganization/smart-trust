# platform-boundary-guard — memory

**Edit `memory/*.md`, not this file** — `bun run cat agent-memory` overwrites the
region below; outside it is yours. Types: **STABLE** · **TRAP** · **BASELINE**
(re-measure, never quote). Compact on purpose: every line here is a line of
the 200-line injection budget the entries need.

<!-- folio:memory:begin -->

## STABLE — link style: `raw` is not the private-repo answer

A private folio whose README links to `https://<owner>.github.io/...` is
unreachable for exactly the people who have repository access, and
`raw.githubusercontent.com` does not fix it — it 404s on a private repo
without a token, and a browser session cookie does not authenticate it.

Default is **`blob`** (`github.com/<owner>/<repo>/blob/<ref>/<path>`): follows
the viewer's GitHub session, works public or private, renders PDFs inline.
`pages` and `raw` remain available under `readme.linkStyle` in
`<name>.config.json`, and each prints a note under the table saying who can
follow its links.

## STABLE — placement is a SKILL — run it before the first file exists

`skills/kg/kg-core/placement.md` is a four-step decision procedure with a
stop — **instance → declared graph → kind of node → which of the two
unrelated "stub" conventions**, and when you cannot tell, ask rather than
default to the repo you are standing in. Run it **before** adding a skill,
role, actor, workflow, decision table, schema, tool or content object, and
before writing any literal that names one folio.

Four entries that restated parts of it are archived rather than kept here
(`the-shape-of-every-defect-here`, `adapter-vs-profile`,
`compose-nothing-resolve-everything`,
`the-readme-generator-that-replaced-the-whole-file`) — still nodes in the
declared `memory` graph, in no prompt. **The skill governs; this is a pointer, not
a summary of it.** Where they would disagree, the skill wins — so read it,
and fix it there rather than restating it back into this file.

## STABLE — re-measure, do not quote

| what | command |
|---|---|
| folio-specific literals in platform code | grep the change for a paper dir, a title, an owner/repo, a Lake prefix, a workflow filename |
| README sections a folio can opt into | `bun run cat readme:sections` |
| README staleness | `bun run cat readme:sync:check` |
| block-kind classification totality | read `schemas/content/block-kinds.ts`; `DOCUMENT_BLOCK_KINDS` must stay derived |

> Relabelled from BASELINE to STABLE, 2026-09-19. `AGENTS.md` defines a
> BASELINE as *"a measured number, stored with the command that produced it
> and the date"* — and this entry stores no number. It is a table of commands
> to RUN, which is the opposite thing: a stable fact about how to measure,
> not a measurement. `MemoryNodeSchema` refused it as a baseline, correctly.

## STABLE — the builder shim, and why `folio_init` is generic

`bun run cat init-folio` / the `folio_init` MCP tool writes a folio's `content/`,
`uploads/`, `library/`, manifests, `<name>.config.json`, the root
`index.config.json` that instantiates it (skill `index-config`), the `content/schema/`
builder shim, `AGENTS.md` + `CLAUDE.md`/`GEMINI.md` stubs, `.mcp.json`, the
session-start hook and the work items store.

- **The builder shim exists so the path to folio-assistant is written down
  once**: block manifests import `../schema/builders`, never the platform
  directly, so re-linking is a two-file edit rather than a corpus sweep.
- **`folio_init` is registered among the generic tools**, not in an adapter,
  because it runs *before* the folio has a content type. A bare repo falls
  back to the paper adapter, so an adapter-scoped tool would be unreachable
  in exactly the case it exists for.

## STABLE — `gh-pages` keeps an append-only render log at `_render-log/`

*What happened to `branches/<slug>`?* — `_render-log/<YYYY-MM-DD>.jsonl` at the
branch ROOT, outside `branches/` so `rm -rf "branches/$SLUG"` cannot reach it.

A full replace does NOT preserve it: `CARRIED_PREFIXES` in
`restore-staging.ts` carries it across, and `--verify` checks the carry as well
as the previews. Add a prefix there, never a third code path. Skill:
[`ui-core/render-logging.md`](../../../skills/ui/ui-core/render-logging.md).

## STABLE — top level = bootstrap/ + one dir per repo + beans/ todos/ fsh-guts/, which stay because they ARE the instance's memory

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

## TRAP — "could not determine" is a THIRD state, everywhere

A section that cannot read its source returns `skip` and the region is left
exactly as it was. Not decoration:

- qou configured its simulators under `folio-assistant/simulators`, which
  existed only once the platform submodule was checked out. The first version
  rendered "directory absent" as "this folio has no simulators" — replacing a
  correct nine-row table with a sentence. qou owns them outright since
  2026-09-19, so that cause is gone and the third state is what still
  covers a sparse checkout or an undeclared directory.
- A shallow clone with no `gh-pages` must not silently blank a contents table
  that was right yesterday.

**An empty directory is still a determined empty.** Distinguish absent from
unreadable, always.

## TRAP — never encode an unverified constraint — a rule that refuses a working setup is worse than no rule

Owner, 2026-09-19: **"dont encode rules against a working setup."**

A constraint is a REFUSAL, and the two failures are not symmetric: a missing
one fails visibly at the point of use; a wrong one refuses a good setup with a
confident message, and nobody investigates a settled question. So an asserted
but unverified constraint stays OUT of the gate.

Encode an entailment of the mechanism, or something measured here with the
command shown. Never "someone said so".

Full rule, the worked case and both lanes:
[`conduct-core/unverified-constraints.md`](../../../skills/conduct/conduct-core/unverified-constraints.md).

## TRAP — the schema cannot catch a profile violation

`pipeline/profile-check.ts` runs on every `content_validate` and
catches what **Zod structurally cannot**: a `theorem` is a valid `theorem`
whatever folio it sits in, and `constraints.ts` cannot read
`<name>.config.json`.

Two rules: kind-within-profile, and (document only) **no `lean` field and no
`.lean` sibling** — because `remark`, `example`, `algorithm` and `simulator`
all *declare* an optional `lean` that the type permits and the profile
forbids.

## TRAP — three literals worth recognising in new code

Each shipped once:

1. **Modules prefixed `QOU.`** regardless of the folio's Lake library. Now
   read from `lakefile.toml`, and left **unprefixed** when no lakefile names
   one — *a wrong namespace is worse than none*, because it is what a reader
   pastes into an `import`.
2. **Workflow descriptions from a hardcoded map of twelve `qou` filenames**,
   consulted *before* the workflow's own `name:`. Now always the `name:`.
3. **The simulator directory as the literal `folio-assistant/simulators`.**
   Now `<name>.config.json`, and the fallback is the folio-root `simulators`
   — the platform has no such directory since 2026-09-19.

<!-- folio:memory:end -->

## Session log

One line per review: what you checked, any literal caught, any TRAP added.
Prune the log, never the TRAPs.
