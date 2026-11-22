---
name: corpus-commit-contract
description: >
  The contract the `corpus` role is held to when an accepted edit is committed
  into it: take the write only on the editor's acceptance, as one change with
  its QA sidecars, under the commit-hygiene requirement and with no relaxing of
  that policy. The narrowest contract the editing diagram requires. A
  mechanical role's skill is a contract to test against, not instructions to
  read.
tested-by:
  - scripts/tests/corpus-commit-contract.test.ts
---

# Corpus — committing an accepted edit

`corpus` (declared below this layer) is played by a **mechanical** actor: the
versioned content store, which is written to and decides nothing. A role
played by a machine is still a role, and its skills are its **contract**: the
responsibilities it must perform, which a test can hold it to. This skill is the part of that contract this layer's diagrams
rely on, and nothing more.

## Where the diagrams lean on it

`Lane_Corpus` in `editing-hci-validation` (opt-in `folio-assistant-core.collab`)
names this role and holds one activity, `Task_Commit`. What that lane's
documentation and the task's say is the whole contract.

## What it must do

1. **Receive the write only after the editor accepts.** `Task_Commit` is
   reachable from no path except `Gateway_EditorDecision`'s `accept` branch
   (the lane's documentation). A change the editor discards, or one that has
   not reached the editor, never reaches the corpus.
2. **Take the change together with its QA sidecars.** "Only now does the change
   become corpus content, together with its QA sidecars" (the task's
   documentation): the block and the findings about it arrive as one change.
3. **Hold the commit to the commit-hygiene requirement**
   (`req:commit-hygiene`), and allow no relaxing of it: the task's policy is
   `relaxable="false"`, because this is the one step that is irreversible in a
   way nothing upstream is.

## Not its responsibility

Drafting the change, validating it, or deciding whether to accept it. Those
happen in the author's, the pipeline's, the reviewer's and the editor's lanes
before anything reaches the corpus. Resolving the bean afterwards is the work
plan's.

## Tests

The test in `tested-by:` drives the editing process with the harness's
workflow engine and checks line 1 (the commit is enabled only after `accept`),
and checks that the diagram binds the lane to this role and carries line 3's
policy. Line 2 and the content of the commit-hygiene statements are not
exercised: no code in this layer performs the commit.
