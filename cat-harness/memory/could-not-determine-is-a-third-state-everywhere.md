---
$schema: folio-memory/v1
id: could-not-determine-is-a-third-state-everywhere
label: trap
summary: "\"could not determine\" is a THIRD state, everywhere"
createdAt: 2026-09-19
roles:
  - code-reviewer
references:
  - kind: agent
    id: platform-boundary-guard
---
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
