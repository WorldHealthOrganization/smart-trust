---
name: board-diagram-interchange
description: >
  A board is a DIAGRAM OF a folio, not a container of one. The OMG split
  between the semantic model and its layout, why the arrow runs one way, and
  what a note may never carry.
---

# Relationship first, visualisation later

Treat a board like the OMG specifications treat BPMN layout: **relationship
first, visualisation later.** BPMN separates the semantic model — `bpmn:process`, its tasks and its flows —
from **Diagram Interchange**: `BPMNDiagram`, `BPMNShape`, `BPMNEdge`, which say
where each of those was drawn. They are two documents about one subject, and
the layout one points **at** the semantic one, never the other way.

A folio board is the same shape:

```
semantic model        notes, anchors, content nodes     what is true
diagram interchange   board-positions.json              where it was drawn
```

## What follows

**A folio is complete with no board.** Deleting every board loses layout and
no content. That is the test to apply when you are unsure whether something
belongs on the board or in the folio: if losing it would lose a fact, it is not
layout.

**A note carries no `x`, no `y`, no `board`, no `position`** — for the same
reason a BPMN task carries no coordinates: layout lives on top of notes, not
as data within them.

**One note may sit on several boards**, at different places, without the note
arbitrating between them. A coordinate on the note could not express that; a
layer above it does so for free.

**An orphan is swept from the LAYER**, which is the easy direction: one file,
one pass, and nothing edited out of a note a person owns.

## The arrow, and how it is kept

```
folio  ──▶  board  ──▶  position  ──▶  note        allowed
note   ──▶  position / board / folio               REFUSED
```

This is a property a future edit can break silently, so it is **checked rather
than described**. `schemas/board-positions.test.ts` asserts two things against
the SOURCE:

- no field named `x`, `y`, `board` or `position` appears in `todo.ts`,
  `carried-note.ts`, `landing-sticky.ts` or `note-anchor.ts`;
- `board-positions.ts` imports `zod` and nothing else — it names notes by id,
  and an id needs no type from the layer below.

The first guards the failure that actually happens: somebody adding coordinates
to a note "for convenience", which makes a `content` node carry `state` and
gives one note two answers on two boards.

## Two graph typologies, because they are two things

| kind | holds | what it is |
|---|---|---|
| `boards` | **content** | what a board is and what it shows |
| `board-positions` | **state** | where each note was drawn |

`content-context-and-state-graphs` refuses a content node that carries state,
which is the same rule one level up. And `check:graph-typology-work` asks a
sharper question of the second: it *is* state, written by a running process
every time somebody moves a note — but **state that records a position in a
PROCESS is work, and state that records a position on a CANVAS is not.** Both
kinds declare `recordsWork: false`.

## A board declares what it SHOWS, and absent means everything

`schemas/ui/board.ts`: an optional `filter` over `pages` and `kinds`, OR within an
axis and AND across them. **Absent is the default and it means the whole
folio** — a query rather than a stored list, because a list of content nodes
needs something to notice that a listed node was renamed and that a new one was
never added, and a query has nothing to fall behind.

Every harness above the floor has a board filled with all contents, which is
the absent filter — so the minimal board and the total board are the same
document.

## Mergeability is the reason for the shape, and its limit is stated

Positions are the most concurrently-edited state a folio has: two sessions
moving two notes is the ordinary case. So the document is sorted and indented,
one note per line-block, and the sort is **idempotent** — a writer that
reshuffled on save would conflict with every other save.

**It is a partial fix.** Two notes that sort *adjacent* still conflict, because
the inserted lines overlap. This removes the guaranteed conflict, not every
conflict, and it should not be trusted further than that.

## What this skill is NOT

**Not the rendering.** How a board draws, when a card becomes its avatar and
what an open window does are [`board-windows`](board-windows.md).

**Not the tiles.** Which boards and viewers a reader can reach is
[`harness-tiles`](harness-tiles.md).
