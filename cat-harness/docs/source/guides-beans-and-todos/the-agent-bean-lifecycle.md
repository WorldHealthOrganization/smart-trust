The work item lifecycle is a process of its own, `bean-lifecycle` (opt-in `cat-harness.sdlc`). Three of its edges matter most.

**The first step is a search, not a creation.** `beans create` is not
idempotent: it mints a fresh identifier on every call and de-duplicates on
nothing, so re-entering a step duplicates the plan rather than doing nothing.
The exact-title check is what stands between a repeated workflow step and a
corpus of near-identical work items.

**Ownership is a gateway, not a courtesy.** A work item another session claimed is
not yours to resolve, scrap or delete. Claiming is how two sessions avoid
picking up the same item; closing someone else's is how one of them loses work
it had not finished reporting.

**"Blocked" is not "not wanted".** A blocked work item returns to `todo` with its
blocker recorded and something said about what would clear it. Leaving it
`in-progress` is worse than either: an item nobody is progressing reads, to
every other session, as active work.
