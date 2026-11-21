---
name: crdm-needs-assessment
description: >-
  Facilitate Phase 1 (Needs Assessment) of the CRDM requirements workflow.
  Guide the BA through stakeholder identification, source material gathering,
  and synthesising a domain-language needs statement. Post to the GitHub issue
  and iterate until the BA confirms the need is correctly captured.
---

# Phase 1 — Needs assessment (detail)

This skill expands the Phase 1 summary in `crdm-requirements-workflow.md`.
The agent facilitates; the BA provides domain knowledge.

## Identifying the requester

Determine who is asking and their role:

| Role | What they bring |
|---|---|
| **BA / Feature Requestor** | Domain knowledge, stakeholder access, sign-off authority |
| **Content Author** | First-hand experience with the gap |
| **Managing Editor** | Cross-folio perspective |
| **Technical Reviewer / SME** | Deep subject-matter expertise |
| **Programme Lead** | Strategic priority, resourcing |

The requester is the BA for this CRDM cycle. They interact with the agent;
stakeholders interact with the BA.

## Identifying stakeholders (systematic 4-step approach)

1. **Check each active folio's `<name>.config.json`** roles — `authors`,
   `editors`, `reviewers`, `contributors`, `affiliations`
2. **Check `.github/CODEOWNERS`** — subsystem ownership
3. **Check recent activity** — `gh issue list --search "..."`,
   `gh pr list --search "..."` for who's been working in the area
4. **Ask the BA directly:** *"Who else is affected by this change?"*

Categorise stakeholders:
- **Approvers/Governance** — must sign off (e.g. review committee)
- **Direct Operators** — will use the feature daily
- **Downstream Consumers** — affected indirectly (e.g. country adaptation teams)

## Gathering source material

The request may arrive through any of these channels:

| Source | How to access |
|---|---|
| Chat messages in the current session | Current context |
| GitHub issue body or comment | `gh issue view <number>` |
| Uploaded document (Word, PDF) | `uploads/` directory |
| Referenced document in library | `library/` directory |
| Issue comment attachment | Download via `gh` |
| Pasted Teams/email discussion | Current context (motivation, not spec) |

**Probing discipline:** begin with the end in mind. Distinguish:
- Symptoms vs root causes
- Workarounds vs missing capability
- One user's need vs shared need

## Synthesising a needs statement

Every needs statement follows this structure:

1. **Current state** — what exists today (specific, not vague)
2. **Gap** — what is missing or broken (the actual problem)
3. **Desired outcome** — what should happen after the feature
4. **Who benefits and how** — named roles, concrete improvements
5. **Workflow rationale** — how this fits the broader process

### No jargon (STRICT)

Write for business stakeholders and domain experts, not developers:

| ❌ Avoid | ✅ Use instead |
|---|---|
| Zod schema validation | "the system checks the structure" |
| AST traversal | "scanning the document" |
| TypeScript types | "the data format" |
| Pipeline stage | "processing step" |
| CLI flags | "options" |
| MCP tool | "assistant capability" |

## Posting to the issue

1. **Scan for existing issue first** — `gh issue list --search "..."`
2. **Never create an issue without BA permission**
3. Post the needs statement as a comment:
   ```bash
   gh issue comment <number> --body-file /tmp/needs-statement.md
   ```

## Requesting feedback

After posting, ask the BA:
- "Does this capture what you need?"
- "Are any stakeholders missing?"
- "Is the desired outcome specific enough to test?"

The BA coordinates with stakeholders. The agent does not contact
stakeholders directly.

## Exit gate

**BA confirms the needs statement** before proceeding to Phase 2.

## Cross-references

- [`crdm-requirements-workflow`](crdm-requirements-workflow.md) — the parent workflow
- [`crdm-detect`](crdm-detect.md) — what triggers this phase
- `../../work-plan/skills/work-plan/todo-manager.md` (opt-in `cat-harness.work-plan`) — work item management
