---
name: bpmn-detangle
description: >
  Make a BPMN diagram readable at 100% without zooming, and untangle it: keep
  it inside the size budget, give every label a place clear of other labels,
  flows and boxes, remove crossings, and swap lanes when another order makes
  the flows between lanes shorter. Run before and after every diagram edit.
adapters: [document, paper, dak]
profiles: [document, paper]
graph-typologies:
  - processes
---

# bpmn-detangle

A diagram must read at 100% without zooming: a page shrinks a wide pool's text
until it cannot be read, and a label drawn over a flow or another label hides
what it names.

This is the ArchiMate rule ([`archimate-models`](../../ui/ui-core/archimate-models.md)
§"Untangle every view you touch") for BPMN: **a change never adds a tangle,
and the diagram you touch leaves cleaner than it came.**

## The check

```
bun run cat bpmn:detangle <file.bpmn|dir>            # report
bun run cat bpmn:detangle <file.bpmn> --write        # also fix what it can: lanes, flows, boxes, labels
bun run cat bpmn:detangle <file.bpmn|dir> --check    # exit 1 on any finding
```

`render:bpmn` prints the same findings as warnings for every diagram it
draws, and `kg:audit` writes the ones the DI alone can show into each
process's QA report, so the QA side sees them without running anything. The
criteria live
in `cat-harness-tools/src/workflow/diagram-fit.ts`:

| finding | means | fix |
|---|---|---|
| `diagram-too-wide` | wider than 1400 | close column gaps; stack steps of different lanes in one column; split by phase |
| `diagram-too-tall` | taller than 900 | shrink each lane to its rows; split by phase |
| `label-overlap` | two labels on each other | give one a `BPMNLabel` position clear of the other |
| `label-on-edge` | a label on a flow, its own included | `--write` moves it to the nearest clear place |
| `label-on-shape` | a label on a box, its own shape, or a lane's name strip | `--write` moves it |
| `label-on-lane-line` | a label drawn across the line between two lanes, or a pool's top, bottom or right edge | `--write` moves it inside one lane |
| `edge-diagonal` | a flow runs at a slant | `--write` routes it at right angles through the gap |
| `header-overflow` | a pool or lane name spills out of its 30-wide strip | `--write` makes the lane taller; or shorten the name (never repeat the process id in the pool name) |
| `text-overflow` | a name spills out of its box | shorten the name: a task box is a fixed 120 × 120 square and never grows |
| `edge-crossing` | two flows cross | re-route one around the other, move a step, or swap lanes |
| `edge-through-shape` | a flow is drawn through a box it neither leaves nor enters | route it around the box (`--write` never adds one) |
| `edge-through-own-end` | a flow starts inside the box it leaves, or runs on inside the box it enters: its waypoints were laid for a box of another size | start it on the side of the box it leaves, end it on the side it enters |
| `edge-detached` | a flow's first or last waypoint is more than 6 from its own box | move that waypoint onto the box's edge |
| `shape-outside-pool` | a step drawn above, below or past its pool | move it into its lane, or widen the pool and its lanes |
| `lane-order` | another lane order crosses fewer lane boundaries | `--write` applies it |

Labels are checked where bpmn-js **draws** them, so the check uses the
browser when one is installed. A file without `BPMNLabel` bounds leaves the
placement to bpmn-js, and only the drawing shows that a gateway's question,
wrapped to three lines under the diamond, lands on the flow leaving it.

## Why 1400 × 900

The renderer draws text at 16px (bootstrap-tools `TEXT_STYLE`). A page shows a diagram at most about 1200px wide once the nav
rail is taken off a 1440px screen, so a diagram `W` wide shows its text at
`16 × 1200 / W` px: about 14px at 1400. About 760px of a 900px screen is
left under the header and the figure toolbar, so 900 keeps a diagram on
about one screen. Change the budget and the text size together.

## The procedure

1. **Run the check before you edit**, and note the counts.
2. **Fix the lane order first.** `--write` tries every order of the lanes (up
   to 8) and keeps the one whose flows cross the fewest lane boundaries,
   only if it adds no flow crossing and draws no flow through a box. It
   moves shapes with their lane, and each flow between lanes keeps its
   bends, each moving with the lane it lies in; only a flow that would then
   run through a box is re-drawn, by the first right-angled route that runs
   through none. If the layout fixes together would add a flow through a
   box, a crossing or a slant, the file keeps its layout and only its labels
   move. Look at the result: it is a start, not a layout.
3. **Make it compact.** Tasks a fixed 120 × 120 square (`--write` squares
   them), gateways 50, events 36. A name
   that does not fit at 16px is shortened, never given a bigger box
   (`text-overflow`). About 40–70
   between neighbours in a row; wider only where a flow label needs it.
   **A column can hold one step per lane**: a hand-off straight down from
   one lane to the next is the shortest flow there is. A lane is as tall as
   its rows plus room for labels, no more.
4. **Right angles only.** A flow between lanes leaves the side facing its target,
   turns once in the gap between the two columns, and enters the target's
   side: never one slanted line from box to box.
5. **Route the loops below.** A loop-back leaves through the bottom, runs in
   the channel under the row and comes up into its target
   ([`bpmn-processes`](bpmn-processes.md) §"Edge routing").
6. **Place every label.** A gateway's question goes **above** the diamond,
   its answers beside their flows; an event's name beside or below it, clear
   of the flows leaving it and of the lane's name strip; a flow label beside
   its own segment; and every label inside one lane, never across a lane
   line. `--write` moves each label that touches a flow, a shape, another
   label, a lane line or a name strip to the nearest clear place (around its
   shape, or beside a run of its flow), and writes that as its `BPMNLabel`
   bounds; what it cannot place it still reports. Give a multi-line label
   room for the lines it wraps to: bpmn-js wraps an outside label to the
   width of its `BPMNLabel` bounds, so a gateway question about 40
   characters long is five lines (about 90 tall) at width 90 and three lines
   at width 130. The check measures the text bpmn-js drew, not the bounds.
7. **Run the check again**: zero findings on the diagram you touched, or say
   in the PR which remain and why.
8. **Look at the rendered SVG**, at 100% in a 1200px band. The check finds
   collisions; only looking finds a diagram that is clean and still confusing.

## Laying it out by hand: patterns that work

`--write` moves labels, lane order and right angles; it refuses any move
that would add a crossing, so on a tangled diagram it changes little and the
layout is redone by hand (cat-harness#989: 43 diagrams). What worked:

- **Rows inside a lane.** The happy path is one row; each branch or
  loop target gets a row below it, in the column of the gateway that
  leads there. A loop-back leaves its task, runs left in its row or in the
  channel under it, and comes up into its target's bottom. Two loops into
  one task enter at different x, the longer one further left, so they
  never cross.
- **Lanes in the order they talk.** Order the lanes so that each one is
  next to the lanes it exchanges flows with. A flow that crosses a lane it
  does not stop in is read as an interaction with that lane's actor. So an
  actor that talks to only one other lane goes on the outside, next to it:
  the owner who approves the merge steward's card sits below the steward,
  not between the steward and the sibling sessions (owner, 2026-11-07).
  `lane-order` measures the total; this is the rule to apply by hand when
  `--write` cannot.
- **Hand-offs in one column.** A step in another lane sits straight above
  or below the step that hands to it. Put the lanes a path visits **on the
  same side** of the main lane (both helper lanes above, say), so the loops
  below stay free.
- **Wrap a long row.** More than about eight tasks in a row will not fit
  1400. Drop from the end of the first row into a channel, run left, and
  start the second row under the first. Nothing else may sit in that
  channel.
- **A data store inside the region its writers bound.** Place the store
  where every association can reach it without crossing a sequence flow,
  usually in a row under the tasks that write it. If a flow encloses some
  writers, the store goes inside the enclosure too.
- **A gateway has four corners.** Count its flows first. With five or more,
  leave from the midpoints of its lower edges as well, and turn away from
  each other at once.
- **Labels.** A gateway's question goes in a free corner (above, or
  above-left if a flow enters from the top); answers sit beside their own
  segment. A label never starts inside a lane's name strip (the first 30
  units of the lane).
- **Shorten a name** that overflows the fixed 120 box, and say so in the
  PR: a name is content.

## When it still does not fit

Split by phase ([`bpmn-authoring`](bpmn-authoring.md) §"Split by phase:
how"). Past about 20 flow nodes a diagram rarely fits 1400 × 900 at a
readable size, and the phase split is the fix, not a smaller font.
