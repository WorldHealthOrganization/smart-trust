---
# folio-assistant-ih6x
$schema: bean/1.0.0
title: 'RENDERED BPMN: 46 exclusive gateways drew as blank diamonds — isMarkerVisible was never set'
status: completed
type: bug
priority: normal
created_at: 2026-09-26T09:00:59Z
updated_at: 2026-09-26T09:01:15Z
parent: folio-assistant-o3xy
---

Salvaged from #1340 (owner's choice, 2026-09-26), which fixed 7 shapes in 5 diagrams when the repo had 18. Re-measured on origin/main: 46 exclusive-gateway BPMNShapes across 25 of 74 .bpmn files carry no isMarkerVisible, and none is explicitly false. bpmn-js draws the X only when it is true, so each rendered as an empty diamond — the notation's way of NOT saying exclusive.

## Done when
- [x] every exclusive-gateway BPMNShape in every committed .bpmn carries isMarkerVisible="true" (measured by the same scan that found them)
- [x] SVGs regenerated with render:bpmn, and the X-marker path count in the changed SVGs rises by the number of shapes fixed
- [x] render:bpmn:check exits 0
- [x] the shapes it cannot reach are named (bootstrap instance, bean oqdr)

## Summary of Changes

- **46 shapes in 25 files** now carry `isMarkerVisible="true"`; the same scan re-run reports **0 shapes in 0 of 74**. Only `BPMNShape` tags whose `bpmnElement` is an `exclusiveGateway` id were touched; none carried an explicit `false`.
- `render:bpmn` rewrote **24 SVGs**. The bpmn-js X-marker path in those 24 went **3 → 46** markers (12 → 184 path fragments, 4 per marker) — **43 added**, which is 46 minus the 3 below. That the count moved is the evidence the attribute is what the renderer reads, not an assumption about bpmn-js.
- `render:bpmn:check` exits 0.
- **Not reached:** the 3 shapes in `bootstrap/processes/initialize-harness.bpmn` are fixed in the source but its SVG is rendered by nothing — `render:bpmn` reads only the cat-harness instance's declared graph. Recorded on `oqdr`, which already owned that defect; its SVG has gone 10 source commits without a re-render.
- #1340's original "18/18 pass" is not reused as evidence: the repository now holds 74 diagrams and it fixed 7 shapes in 5 of them.
