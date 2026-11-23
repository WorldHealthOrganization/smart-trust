Two different things can change a work item, and a step that confuses them will
announce an effect it does not have.

**The workflow engine** performs `claim`, `note` and `resolve` on a process
instance's own work item when a step marked `<cat-harness.processes:bean op="…"/>` completes.
`claim` sets `in-progress` and is idempotent; `note` appends; `resolve`
completes the work item **only once the instance itself has completed**, because
whether work is done is a judgement and a work item is not closed on someone else's
say-so.

**The agent** does everything else with the `beans` CLI: creating, scrapping,
retitling, setting a blocker. The engine has no operation for any of these.

**When you add a bean-marked step,** use one of the three operations the
engine implements, and say in the step's documentation which parts are the
agent's own CLI calls. `bun run cat check:workflow-refs` will catch a skill
reference that does not resolve; it cannot catch a plausible attribute the
engine never reads.
