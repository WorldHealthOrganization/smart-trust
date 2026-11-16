---
name: two-phase-move
description: >
  Move a path that other layers link to without making the order of their
  re-pins matter: the moving layer declares the move and keeps answering at
  the old path for a window, the dependent layers switch in any order, and the
  old path goes once nothing links to it. Use before moving or renaming a
  directory another layer links into.
governs:
  - cat-harness
---

# Two-phase move

> Skill id: `two-phase-move` · Package: `sdlc-core`
> Related: [`kg-separation`](../../../skills/kg/graph-management/kg-separation.md) (the post-move sweep), [`upstream-version-adoption`](../../../skills/process/process-core/upstream-version-adoption.md)

## Why

A layer that moves a path other layers link to, in one step, makes a cycle
across pins. The dependent layers cannot switch to the new path until the
checkout pins the moved layer, and the checkout cannot pin the moved layer
until the dependent layers have switched. Each side is red only because the
other has not landed.

This happened when cat-harness moved `skills/sdlc` to `sdlc/skills`. The fixes
in three content layers above it were red only because the index checkout
still pinned the old cat-harness. Main was red for about 250
commits, and 14 re-pin trains failed on the same links, about 17 % of runner
time (folio-assistant#2781, #2946, work item `folio-assistant-tsh9`).

## The rule

For a move of a path that another layer links to:

1. **The moving layer moves the files and declares the move.** It adds an
   entry to `moves` in its own declaration (`<instance>.json`):

   ```json
   "moves": [
     { "from": "skills/sdlc", "to": "sdlc/skills", "until": "2026-12-31",
       "because": "cat-harness#991 step 23.2" }
   ]
   ```

   `from` and `to` are directories relative to the layer root. While the
   entry is in force, the link checks resolve a link into `from` at the same
   path under `to`. So the old path keeps working for every layer, and the
   new one works too.
2. **Re-pin the moving layer first.** Nothing breaks, because old links still
   resolve.
3. **The dependent layers switch to the new path, in any order.** Each one
   lands on its own. A re-pin train can take them in any order.
4. **Remove the entry once nothing links to the old path.** The
   `check:subgraphs` report lists each declared move with the number of links
   still using the old path. When that number is 0, remove the entry, in a PR
   of its own.

## What the window is, and what it is not

- **Keep the old path by declaring it, not by keeping a copy.** A file left in
  both places mints one identifier twice (`kg-separation`, "A file left in
  BOTH layers").
- **It is not a redirect on the published site.** It only tells the link checks
  that the old path is still answered for.
- **`until` is required.** Past that date the entry is no longer honoured, and
  `check:subgraphs --check` fails until the entry is removed. Pick a date that
  leaves time for every dependent layer to switch, and move it later in a PR
  if they need longer.
- **Only the old path is answered for, not the new one.** A dependent layer
  that switches before the moving layer is re-pinned is red again. That is
  why step 2 comes before step 3.

## Where it is enforced

| step | check |
|---|---|
| 1 | the declaration schema refuses an entry without `from`, `to` and an `until` date |
| 2, 3 | `check:subgraphs` resolves a link into `from` under `to`, and the checkout test that fails on a dangling link (`subgraphs-checkout.test.ts`) passes |
| 4 | `check:subgraphs` reports the links still using the old path, and `--check` fails on an entry past `until` |

The post-move sweep in `kg-separation` still applies to everything else that
names the old path, such as commands, workflow headers and Tool invokes. Those
live in the layer that runs them, so they are fixed in the same PR as its
re-pin.
