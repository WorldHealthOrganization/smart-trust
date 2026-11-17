---
name: knowledge-graph-data-store
description: >
  The contract a Knowledge Graph Data Store keeps: serve a declaration, its
  graph and its instructions exactly as committed, say plainly when a file is
  absent, and keep a new layer's declaration once it is written. A
  mechanical Actor plays this Role; this is what it must do, and what it can be
  tested against.
tested-by:
  - https://github.com/litlfred/bootstrap-tools/blob/main/scripts/knowledge-graph-data-store.test.ts
---

# The Knowledge Graph Data Store's contract

**A data store plays a Role, and this is the Role's contract.** It decides nothing about what should happen. What it must do is
below, and each line is something a test can check.

It is a git repository, reached through the git CLI or a forge's API. It sits
in the `Knowledge Graph Data Store` lane of
[`initialize-harness`](../processes/initialize-harness.bpmn) and
[`complete-initialization`](../processes/complete-initialization.bpmn). The
Actor reading from it follows [`bootstrap-kg-navigation`](bootstrap-kg-navigation.md);
this skill is the other side of those reads.

## Responsibilities

1. **Serve a file exactly as committed.** A read of a path, at a ref, returns
   the bytes committed there. That covers the declaration `<name>.json` at the
   root, the files it lists, and the instructions at the predetermined path
   `docs/bootstrap/initialization.md`.
2. **Tell absent from present.** A read of a path that is not committed says
   *absent*. It does not return an empty file or an error that could be taken
   for an unreadable one. `bootstrap-kg-navigation`'s three answers (absent,
   present, present-but-unreadable) depend on this.
3. **Serve siblings the same way.** A `needs` entry is read from a sibling
   checkout, `../<name>/<name>.json`, under the same two rules.
4. **Keep what is written.** Once a new layer's declaration is written and
   committed, later reads return it, and its history shows who wrote it and
   when.

## Tests

Bootstrap runs nothing, so the test named in `tested-by:` lives with the
toolset. It checks each numbered line above against a git repository read
through the git CLI.

## Not its responsibility

Deciding whether a location is a layer, which harness to install, or what
a declaration means. Those are judgements made in the Bootstrapping Agent's
lane, using the files this store serves.
