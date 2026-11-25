The skills and tooling that implement the methodology are in various stages
of development. What follows is checked against the repository, because a gap
list that goes stale sends a reader looking for something that is already
there.

**Built:**

- **CRDM detection skill** — [`skills/process/crdm/crdm-detect.md`](https://github.com/litlfred/cat-harness/blob/main/skills/process/crdm/crdm-detect.md)
  gives the agent five categories of detection phrasing, an explicit "what is
  *not* a feature request" list, and the session-state rules (new session,
  existing session already in the process, existing session doing content
  work). The judgement is written down; it is not yet *measured*, so see the
  caveat below.
- **`stakeholder_map`** — reports which skills a change touches, the roles
  they declare, and the process lanes accountable for work that uses them.
  It does not name people, because the process says the agent does not
  guess.
- **The process is executable** — `crdm-requirements.bpmn` loads like every
  other diagram here, so `workflow_start` / `workflow_next` /
  `workflow_complete` run it today, and `workflow_complete` refuses a step
  that is not enabled. Every activity in the agent's lane names the skill
  that implements it, and three carry the work item operation the engine performs.
- **BPMN diagram of the process itself** —
  [`processes/process/crdm-requirements.bpmn`](https://github.com/litlfred/cat-harness/blob/main/processes/process/crdm-requirements.bpmn),
  with lanes for the BA / feature requestor, the agent, and stakeholders.
- **The six-phase workflow as a skill** —
  [`skills/process/crdm/crdm-requirements-workflow.md`](https://github.com/litlfred/cat-harness/blob/main/skills/process/crdm/crdm-requirements-workflow.md),
  including the actors table and the issue-association rules.

**Not yet implemented:**

- **Structured requirements templates** — no MCP tool scaffolds the CRDM
  phases into a GitHub issue. The structure described above is written by
  hand each time.
- **Automated impact analysis** — the agent can read the content graph and
  the schema files, but no dedicated tool produces an impact report for a
  proposed change.
- **Review triage tooling** — ingesting a Word document with comments and
  presenting them for structured triage is not built.

**Measured, with a known weakness.** The detection skill has been run against
every issue in this repository (27,
the whole population, not a sample) via `bun run cat eval:crdm-detect`:

| | fired | did not |
|---|---|---|
| **is a feature request** | 12 | 7 |
| **is not** | 5 | 3 |

**precision 71% · recall 63% · F1 67%** — measured 2026-09-18 on `main`.

Two things that number is not. It runs the skill's **phrase list** only, so
it is a *lower bound* on an agent that also applies judgement. And the ground
truth is **one annotator's, unblinded** — the same agent wrote the labels and
the scorer. Fix that before quoting these as a property of the skill rather
than of this corpus.

The failure *pattern* is more useful than the score. The seven misses include the
issue that asked for this capability and the framework-design issue. The five false alarms are two migration **records** of work already
done, two asks to **document** an existing pipeline, and one bug report.

That points at a specific gap: the skill's "what is NOT a feature request"
list excludes *content* tasks — writing a section, fixing a typo, reviewing a
chapter — but says nothing about **records of completed work** or
**documentation about a feature**, which are what it actually confuses here.
Those two exclusions are the cheapest available improvement.
