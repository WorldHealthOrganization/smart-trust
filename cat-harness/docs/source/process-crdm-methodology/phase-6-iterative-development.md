Once requirements are signed off and work items are created, the agent and BA
enter the **iterative MVP development cycle**. This is where the feature
gets built, tested, and refined until stakeholders accept it.

### The inner loop: BA ↔ Agent

The BA and agent work together in tight iterations:

```
                ┌──────────────────────────────────────────┐
                │              INNER LOOP                  │
                │                                          │
                │   Agent                        BA        │
                │   ┌─────────┐    PR + demo    ┌──────┐  │
                │   │Implement├───────────────►│Review │  │
                │   │ (bean)  │                │ + test│  │
                │   │         │◄───────────────┤       │  │
                │   └─────────┘   feedback      └──────┘  │
                │                                          │
                └──────────────────────────────────────────┘
```

1. **Agent claims a work item** — implements the requirement on a feature
   branch, opens a PR, posts a summary to the issue.
2. **BA reviews** — tests the feature, compares it against the requirement
   and acceptance criteria from Phase 3. The BA does not need to read code;
   they test the *behaviour*.
3. **Feedback or accept** — the BA either requests changes (the agent
   iterates) or accepts the increment.
4. **Repeat** until the work item is resolved.

Each work item produces a **minimum viable increment** — not the whole feature,
but one requirement satisfied. The BA decides when enough increments have
accumulated to show stakeholders.

### The outer loop: BA → Stakeholders

When the BA judges that the delivered increments constitute an **MVP worth
testing**, they bring stakeholders in:

```
   ┌──────────────────────────────────────────────────────────────┐
   │                      OUTER LOOP                              │
   │                                                              │
   │   BA                          Stakeholders                   │
   │   ┌──────────┐   MVP demo   ┌────────────────┐              │
   │   │Accumulate├─────────────►│Test in context │              │
   │   │increments│              │(their workflow)│              │
   │   │          │◄─────────────┤                │              │
   │   └──────────┘   findings   └────────────────┘              │
   │        │                                                     │
   │        ▼                                                     │
   │   Translate findings into                                    │
   │   agent-actionable feedback                                  │
   │   (new beans or bean updates)                                │
   │        │                                                     │
   │        ▼                                                     │
   │   Re-enter inner loop                                        │
   └──────────────────────────────────────────────────────────────┘
```

1. **BA shares the MVP** — the staging URL, a demo, or a walkthrough. The
   BA frames it: "here is what we built, here is what it does, here is
   what we need you to test."
2. **Stakeholders test** — in their own context, with their own data,
   against their own workflows. They report what works and what does not.
3. **BA translates findings** — stakeholder feedback is domain language
   ("the table doesn't show the right columns"). The BA translates it
   into actionable direction for the agent ("the `review-triage` view
   needs columns X, Y, Z from the feedback spreadsheet").
4. **Agent iterates** — new work items or updates to existing work items. The inner
   loop resumes.
5. **Repeat** until stakeholders are satisfied.

### The exit: feature sign-off

When all work items for the feature are resolved and stakeholders confirm the
MVP meets their needs:

1. **BA confirms** — all acceptance criteria from Phase 3 are met.
2. **Stakeholders sign off** — on the GitHub issue, not the PR.
3. **Agent closes the issue** — with a delivery summary listing what was
   built, what was deferred, and any new issues opened for future work.
4. **Documentation updated** — the agent updates the docs pages and BPMN
   diagrams to reflect the new capability.

### Why two loops, not one

The inner loop is **fast** — the BA and agent can iterate multiple times
per session. The outer loop is **slow** — stakeholders have other work,
need time to test, and may only be available weekly.

Collapsing them into one loop would either:
- Slow the agent down to the stakeholder cadence (wasting agent time), or
- Rush stakeholders through testing (producing shallow feedback).

The BA absorbs the impedance mismatch. Between outer-loop checkpoints, the agent works on other work items or
other features.
