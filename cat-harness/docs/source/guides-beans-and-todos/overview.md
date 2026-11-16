**Work items are for agents. Todos are for humans.** They share a word in ordinary
speech and nothing else, and conflating them is how a work plan comes to hold
two kinds of thing that need different handling.

A **work item** is process state an agent keeps while doing work: claimed before
starting so a sibling session avoids it, kept current as the work proceeds,
and closed with a record of what changed. The store is `beans/`, committed,
so it survives a reclaimed container and is visible to every other session.

A **todo** is a person's own reminder — what they mean to look at next. It is
theirs to create, reorder and discard on no schedule but their own, and
nothing about an agent's process should be deciding when it is done.

This page describes the first in full. The second is **not built yet** and
says so.
