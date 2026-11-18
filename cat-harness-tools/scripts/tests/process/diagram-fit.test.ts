/**
 * The readable-at-100% and detangle criteria (`src/workflow/diagram-fit.ts`),
 * on small diagrams built here so each case shows one thing.
 */
import { describe, expect, test } from "bun:test";
import {
  applyLaneOrder,
  bestLaneOrder,
  crossings,
  diagramFit,
  detachedEdges,
  edgesThroughOwnEnds,
  edgesThroughShapes,
  FIT_WIDTH,
  shapesOutsidePools,
  sharedPorts,
  fixTaskSize,
  offSizeTasks,
  TASK_SIZE,
  laneOrder,
  placeLabels,
  readDi,
  segmentHitsBox,
  segmentsCross,
  straightenFlows,
} from "../../../src/workflow/diagram-fit";

type S = [id: string, x: number, y: number, w: number, h: number, label?: [number, number, number, number]];
type E = [id: string, src: string, tgt: string, pts: [number, number][], name?: string];

function bpmn(lanes: [string, string, number, number][], shapes: S[], edges: E[], width = 600): string {
  const lane = lanes.map(([id, name]) => `<bpmn:lane id="${id}" name="${name}"/>`).join("");
  const nodes = shapes.map(([id]) => `<bpmn:task id="${id}" name="${id}"/>`).join("");
  const flows = edges.map(([id, s, t, , n]) => `<bpmn:sequenceFlow id="${id}"${n ? ` name="${n}"` : ""} sourceRef="${s}" targetRef="${t}"/>`).join("");
  const lab = (l?: number[]): string => (l ? `<bpmndi:BPMNLabel><dc:Bounds x="${l[0]}" y="${l[1]}" width="${l[2]}" height="${l[3]}"/></bpmndi:BPMNLabel>` : "");
  const di = [
    ...lanes.map(([id, , y, h]) => `<bpmndi:BPMNShape bpmnElement="${id}"><dc:Bounds x="0" y="${y}" width="${width}" height="${h}"/></bpmndi:BPMNShape>`),
    ...shapes.map(([id, x, y, w, h, l]) => `<bpmndi:BPMNShape bpmnElement="${id}"><dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}"/>${lab(l)}</bpmndi:BPMNShape>`),
    ...edges.map(([id, , , pts]) => `<bpmndi:BPMNEdge bpmnElement="${id}">\n        ${pts.map(([x, y]) => `<di:waypoint x="${x}" y="${y}" />`).join("\n        ")}\n      </bpmndi:BPMNEdge>`),
  ].join("\n      ");
  return `<?xml version="1.0"?><bpmn:definitions><bpmn:process id="P"><bpmn:laneSet>${lane}</bpmn:laneSet>${nodes}${flows}</bpmn:process>
  <bpmndi:BPMNDiagram><bpmndi:BPMNPlane bpmnElement="P">
      ${di}
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>`;
}

const LANES: [string, string, number, number][] = [
  ["L1", "One", 0, 100],
  ["L2", "Two", 100, 100],
  ["L3", "Three", 200, 100],
];

describe("geometry", () => {
  test("a cross is a crossing; touching ends and collinear runs are not", () => {
    expect(segmentsCross({ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 5, y: 0 }, { x: 5, y: 10 })).toBe(true);
    expect(segmentsCross({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 })).toBe(false);
    expect(segmentsCross({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 })).toBe(false);
  });
  test("a segment through a box hits it; one passing beside does not", () => {
    const b = { x: 10, y: 10, width: 20, height: 20 };
    expect(segmentHitsBox({ x: 0, y: 20 }, { x: 40, y: 20 }, b)).toBe(true);
    expect(segmentHitsBox({ x: 0, y: 40 }, { x: 40, y: 40 }, b)).toBe(false);
  });
});

describe("size budget", () => {
  test("wider than the budget is reported with the text size it shows at", () => {
    const xml = bpmn([["L1", "One", 0, 100]], [["A", 50, 20, 100, 60]], [], FIT_WIDTH + 200);
    const f = diagramFit(xml)["diagram-too-wide"]!;
    expect(f).toHaveLength(1);
    expect(f[0]!.detail).toContain("px in a 1200px band");
  });
  test("within budget is clean", () => {
    const xml = bpmn([["L1", "One", 0, 100]], [["A", 50, 20, 100, 60]], [], 800);
    expect(diagramFit(xml)["diagram-too-wide"]).toEqual([]);
    expect(diagramFit(xml)["diagram-too-tall"]).toEqual([]);
  });
});

describe("labels", () => {
  test("a gateway question on its own 'No' answer is an overlap, a label on a flow and on its own shape", () => {
    // The owner's screenshot: "Satisfied with changes?" drawn under the gateway, across the "No" flow and its label.
    const xml = bpmn(
      [["L1", "One", 0, 300]],
      [["G", 100, 20, 50, 50, [80, 72, 90, 40]], ["T", 75, 150, 100, 60]],
      [["no", "G", "T", [[125, 70], [125, 150]], "No"]],
    ).replace('<bpmndi:BPMNEdge bpmnElement="no">', '<bpmndi:BPMNEdge bpmnElement="no">');
    const drawn = {
      labels: [
        { id: "G", text: "Satisfied with changes?", x: 80, y: 60, width: 90, height: 48 },
        { id: "no", text: "No", x: 128, y: 95, width: 20, height: 16 },
      ],
    };
    const f = diagramFit(xml, drawn);
    expect(f["label-overlap"]!.map((x) => x.where)).toEqual(["G+no"]);
    expect(f["label-on-edge"]!.map((x) => x.where)).toEqual(["G/no"]);
    expect(f["label-on-shape"]!.map((x) => x.where)).toContain("G/G");
  });
  test("without a drawing, the file's own label bounds are checked", () => {
    const xml = bpmn([["L1", "One", 0, 300]], [["G", 100, 20, 50, 50, [100, 80, 90, 30]], ["T", 120, 90, 100, 60]], []);
    expect(diagramFit(xml)["label-on-shape"]!.map((x) => x.where)).toEqual(["G/T"]);
  });
  test("a label in a lane's name strip is reported", () => {
    const xml = bpmn([["L1", "One", 0, 300]], [["S", 40, 20, 36, 36, [10, 60, 80, 30]]], []);
    expect(diagramFit(xml)["label-on-shape"]!.map((x) => x.where)).toEqual(["S/L1"]);
  });
});

describe("lane order", () => {
  // A in One, B in Three, C in Two: A→B and B→C each cross lanes they do not stop in.
  const xml = bpmn(
    LANES,
    [["A", 50, 20, 100, 60], ["B", 200, 220, 100, 60], ["C", 350, 120, 100, 60]],
    [
      ["ab", "A", "B", [[100, 80], [100, 250], [200, 250]]],
      ["bc", "B", "C", [[300, 250], [400, 250], [400, 180]]],
    ],
  );
  test("the cheapest order is found, and is reported", () => {
    const best = bestLaneOrder(readDi(xml));
    expect(best.current).toBe(3);
    expect(best.cost).toBe(2);
    expect(diagramFit(xml)["lane-order"]).toHaveLength(1);
  });
  test("applying it moves lanes and their shapes, keeps heights, and re-routes cross-lane flows", () => {
    const best = bestLaneOrder(readDi(xml));
    const next = applyLaneOrder(xml, best.order);
    const di = readDi(next);
    expect(laneOrder(di)).toEqual(best.order);
    for (const [id, b] of di.lanes) expect(b.height).toBe(readDi(xml).lanes.get(id)!.height);
    // Every shape is still inside its lane.
    const before = readDi(xml);
    for (const id of ["A", "B", "C"]) expect(di.shapes.get(id)!.height).toBe(before.shapes.get(id)!.height);
    expect(bestLaneOrder(di).current).toBe(2);
    expect(crossings(di)).toEqual([]);
    // Each re-routed flow starts and ends on its own shapes.
    const ab = di.edges.get("ab")!.points;
    const A = di.shapes.get("A")!, B = di.shapes.get("B")!;
    expect(ab[0]!.x).toBe(A.x + A.width / 2);
    expect(ab.at(-1)!.x === B.x || ab.at(-1)!.y === B.y || ab.at(-1)!.y === B.y + B.height).toBe(true);
  });
  test("an order already at its best is left exactly as it is", () => {
    const flat = bpmn(LANES, [["A", 50, 20, 100, 60], ["B", 200, 120, 100, 60]], [["ab", "A", "B", [[100, 80], [100, 150], [200, 150]]]]);
    const best = bestLaneOrder(readDi(flat));
    expect(best.cost).toBe(best.current);
    expect(applyLaneOrder(flat, best.order)).toBe(flat);
  });
});

describe("crossings", () => {
  test("two flows of one node that cross on the way are a tangle", () => {
    // Stage → Review up the middle, Iterate → Stage across it: the owner's second screenshot.
    const xml = bpmn(
      [["L1", "One", 0, 400]],
      [["St", 50, 300, 100, 60], ["Rv", 250, 20, 100, 60], ["It", 400, 150, 100, 60]],
      [
        ["up", "St", "Rv", [[150, 330], [200, 330], [200, 50], [250, 50]]],
        ["back", "It", "St", [[400, 180], [100, 180], [100, 300]]],
      ],
    );
    expect(crossings(readDi(xml))).toEqual([["up", "back"]]);
  });
});

describe("slanted flows", () => {
  // dth-pc PC-BP-01: Step 2 (lane One) → Step 3 (lane Two) → Step 4 (lane One), each one straight slant.
  const xml = bpmn(
    [["L1", "One", 0, 150], ["L2", "Two", 150, 150]],
    [["S2", 450, 90, 140, 80], ["S3", 640, 230, 140, 80], ["S4", 830, 90, 140, 80]],
    [
      ["f2", "S2", "S3", [[590, 130], [640, 270]]],
      ["f3", "S3", "S4", [[780, 270], [830, 130]]],
    ],
    1100,
  );
  test("are reported", () => {
    expect(diagramFit(xml)["edge-diagonal"]!.map((f) => f.where)).toEqual(["f2", "f3"]);
  });
  test("are re-routed at right angles through the gap, from side to side", () => {
    const { xml: next, fixed } = straightenFlows(xml);
    expect(fixed).toEqual(["f2", "f3"]);
    const di = readDi(next);
    expect(diagramFit(next)["edge-diagonal"]).toEqual([]);
    expect(di.edges.get("f2")!.points).toEqual([{ x: 590, y: 130 }, { x: 615, y: 130 }, { x: 615, y: 270 }, { x: 640, y: 270 }]);
  });
  test("a route through another shape is left for the author", () => {
    const blocked = bpmn(
      [["L1", "One", 0, 300]],
      [["A", 0, 0, 100, 60], ["B", 300, 200, 100, 60], ["X", 140, 20, 30, 260]],
      [["ab", "A", "B", [[100, 30], [300, 230]]]],
    );
    expect(straightenFlows(blocked).fixed).toEqual([]);
  });
});

describe("labels on arrows and lane lines (owner, 2026-10-31: \"need to check for text on arrows\")", () => {
  // A start event whose name hangs below it, over the flow leaving it and
  // across the line into the next lane: the case the owner circled.
  const xml = bpmn(LANES.slice(0, 2), [["A", 100, 30, 36, 36, [73, 70, 90, 54]], ["B", 60, 130, 120, 60]], [["F", "A", "B", [[118, 66], [118, 130]]]]);
  test("a label over the flow leaving its own event, and across a lane line, is reported", () => {
    const f = diagramFit(xml);
    expect(f["label-on-edge"]!.map((x) => x.where)).toContain("A/F");
    expect(f["label-on-lane-line"]!.map((x) => x.where)).toContain("A/L1");
  });
  test("--write moves it to a clear place inside its lane, and the check is then clean", () => {
    const { xml: next, moved } = placeLabels(xml, { labels: [{ id: "A", text: "A", x: 73, y: 70, width: 90, height: 54 }] });
    expect(moved).toEqual(["A"]);
    const label = readDi(next).shapes.get("A")!.label!;
    expect(label.y).toBeGreaterThanOrEqual(0);
    expect(label.y + label.height).toBeLessThanOrEqual(100);
    const f = diagramFit(next);
    expect(f["label-on-edge"]).toEqual([]);
    expect(f["label-on-lane-line"]).toEqual([]);
    expect(f["label-on-shape"]).toEqual([]);
  });
  test("a label already clear is left where it is", () => {
    const clear = bpmn(LANES.slice(0, 2), [["A", 100, 30, 36, 36, [140, 30, 60, 36]], ["B", 60, 130, 120, 60]], [["F", "A", "B", [[118, 66], [118, 130]]]]);
    expect(placeLabels(clear, { labels: [{ id: "A", text: "A", x: 140, y: 30, width: 60, height: 36 }] }).moved).toEqual([]);
  });
});

describe("flows through boxes", () => {
  test("a flow drawn through a step it does not touch is reported", () => {
    const xml = bpmn(LANES, [["A", 50, 120, 100, 60], ["B", 200, 120, 100, 60], ["C", 350, 120, 100, 60]],
      [["F", "A", "C", [[150, 150], [350, 150]]]]);
    expect(edgesThroughShapes(readDi(xml))).toEqual([["F", "B"]]);
    expect(diagramFit(xml)["edge-through-shape"]!.map((f) => f.where)).toEqual(["F/B"]);
  });

  test("a flow drawn through its OWN source and target is reported (cat-harness#991)", () => {
    // code-change-review's f6: laid for smaller boxes, it starts in the middle of
    // "Commit, push, open the PR" and runs up through "Run the gates…" to its top.
    const xml = bpmn(LANES, [["Commit", 50, 220, 120, 60], ["Gates", 40, 20, 140, 60]],
      [["F", "Commit", "Gates", [[110, 250], [110, 20]]]]);
    expect(edgesThroughOwnEnds(readDi(xml))).toEqual([["F", "Commit"], ["F", "Gates"]]);
    expect(diagramFit(xml)["edge-through-own-end"]!.map((f) => f.where)).toEqual(["F/Commit", "F/Gates"]);
    // Side to side, it is clean.
    const fixed = bpmn(LANES, [["Commit", 50, 220, 120, 60], ["Gates", 40, 20, 140, 60]],
      [["F", "Commit", "Gates", [[110, 220], [110, 80]]]]);
    expect(edgesThroughOwnEnds(readDi(fixed))).toEqual([]);
    expect(detachedEdges(readDi(fixed))).toEqual([]);
  });

  test("a flow that stops short of its target is detached", () => {
    const xml = bpmn(LANES, [["A", 50, 120, 100, 60], ["B", 300, 120, 100, 60]], [["F", "A", "B", [[150, 150], [260, 150]]]]);
    expect(detachedEdges(readDi(xml))).toEqual([["F", "B"]]);
  });

  test("a lane swap keeps a loop-back flow's bends rather than drawing it through the lane's steps", () => {
    // D (lane One) loops back to A (lane Two) over the top of B and C.
    const xml = bpmn(LANES,
      [["A", 50, 120, 100, 60], ["B", 200, 120, 100, 60], ["C", 350, 120, 100, 60], ["D", 350, 20, 100, 60]],
      [["F", "D", "A", [[350, 50], [30, 50], [30, 150], [50, 150]]]]);
    const next = applyLaneOrder(xml, ["L2", "L1", "L3"]);
    const di = readDi(next);
    expect(laneOrder(di)).toEqual(["L2", "L1", "L3"]);
    expect(edgesThroughShapes(di)).toEqual([]);
    expect(di.edges.get("F")!.points).toEqual([{ x: 350, y: 150 }, { x: 30, y: 150 }, { x: 30, y: 50 }, { x: 50, y: 50 }]);
  });
});

describe("reading the DI", () => {
  test("a shape whose BPMNLabel comes before its own Bounds is still read, label and all", () => {
    const xml = `<?xml version="1.0"?><bpmn:definitions><bpmn:process id="P"><bpmn:exclusiveGateway id="G" name="Done?"/></bpmn:process>
  <bpmndi:BPMNDiagram><bpmndi:BPMNPlane bpmnElement="P">
      <bpmndi:BPMNShape bpmnElement="G"><bpmndi:BPMNLabel><dc:Bounds x="10" y="70" width="90" height="20"/></bpmndi:BPMNLabel><dc:Bounds x="30" y="10" width="50" height="50"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>`;
    const g = readDi(xml).shapes.get("G");
    expect(g).toEqual({ x: 30, y: 10, width: 50, height: 50, label: { x: 10, y: 70, width: 90, height: 20 } });
  });
});

describe("steps on top of each other", () => {
  test("two steps drawn over each other are reported; apart they are not", () => {
    const over = bpmn(LANES, [["A", 50, 120, 100, 60], ["B", 120, 130, 100, 60]], []);
    expect(diagramFit(over)["shape-overlap"]!.map((f) => f.where)).toEqual(["A+B"]);
    const apart = bpmn(LANES, [["A", 50, 120, 100, 60], ["B", 200, 120, 100, 60]], []);
    expect(diagramFit(apart)["shape-overlap"]).toEqual([]);
  });
});

describe("tasks are one square size (TASK_SIZE)", () => {
  test("a wide task and a short one are both drawn at TASK_SIZE, about their centres", () => {
    const xml = bpmn([["L1", "One", 0, 200]], [["A", 50, 50, 160, 80], ["B", 300, 60, 100, 60]], []);
    expect(offSizeTasks(xml).sort()).toEqual(["A", "B"]);
    const { xml: next, fixed } = fixTaskSize(xml);
    expect(fixed.sort()).toEqual(["A", "B"]);
    expect(offSizeTasks(next)).toEqual([]);
    const a = readDi(next).shapes.get("A")!;
    expect([a.width, a.height]).toEqual([TASK_SIZE.width, TASK_SIZE.height]);
    expect(a.x + a.width / 2).toBe(130);
  });

  test("an expanded sub-process keeps its size", () => {
    const xml = bpmn([["L1", "One", 0, 300]], [["S", 50, 20, 400, 200]], [])
      .replace('<bpmn:task id="S" name="S"/>', '<bpmn:subProcess id="S" name="S"/>')
      .replace('<bpmndi:BPMNShape bpmnElement="S">', '<bpmndi:BPMNShape bpmnElement="S" isExpanded="true">');
    expect(offSizeTasks(xml)).toEqual([]);
    expect(fixTaskSize(xml).fixed).toEqual([]);
  });

  test("only: resizes just the tasks named", () => {
    const xml = bpmn([["L1", "One", 0, 200]], [["A", 50, 50, 160, 80], ["B", 300, 60, 100, 60]], []);
    const { xml: next, fixed } = fixTaskSize(xml, new Set(["B"]));
    expect(fixed).toEqual(["B"]);
    expect(offSizeTasks(next)).toEqual(["A"]);
  });

  test("a diagram already at TASK_SIZE is left byte for byte", () => {
    const xml = bpmn([["L1", "One", 0, 200]], [["A", 50, 40, TASK_SIZE.width, TASK_SIZE.height]], []);
    expect(fixTaskSize(xml).xml).toBe(xml);
  });
});

describe("pools", () => {
  const pooled = (shapes: S[]): string =>
    bpmn([["L1", "One", 0, 200]], shapes, [])
      .replace("<bpmn:process", `<bpmn:collaboration><bpmn:participant id="Pool" processRef="P"/></bpmn:collaboration><bpmn:process`)
      .replace("<bpmndi:BPMNPlane bpmnElement=\"P\">", `<bpmndi:BPMNPlane bpmnElement="P"><bpmndi:BPMNShape bpmnElement="Pool"><dc:Bounds x="0" y="0" width="600" height="200"/></bpmndi:BPMNShape>`);

  test("a step outside every pool is reported; a data store is not (cat-harness#991)", () => {
    const xml = pooled([["In", 50, 50, 100, 60], ["Above", 200, -50, 36, 36], ["Past", 620, 80, 36, 36]])
      .replace('<bpmn:task id="Past" name="Past"/>', '<bpmn:task id="Past" name="Past"/><bpmn:dataStoreReference id="Store"/>')
      .replace("</bpmndi:BPMNPlane>", `<bpmndi:BPMNShape bpmnElement="Store"><dc:Bounds x="100" y="260" width="50" height="50"/></bpmndi:BPMNShape></bpmndi:BPMNPlane>`);
    expect(shapesOutsidePools(readDi(xml))).toEqual(["Above", "Past"]);
    expect(diagramFit(xml)["shape-outside-pool"]!.map((f) => f.where)).toEqual(["Above", "Past"]);
  });

  test("a label across the pool's right edge is on a lane line", () => {
    const xml = pooled([["E", 540, 80, 36, 36, [560, 120, 90, 20]]]);
    expect(diagramFit(xml)["label-on-lane-line"]!.map((f) => f.where)).toContain("E/Pool");
  });
});

describe("a flow in and a flow out never share a point (owner, 2026-11-08)", () => {
  // A at the left, B in the middle, C at the right; F2 leaves B where the loop-back F3 enters it.
  const shapes: S[] = [["A", 20, 20, 60, 60], ["B", 200, 20, 60, 60], ["C", 400, 20, 60, 60]];
  test("an outgoing flow that leaves where another arrives is reported", () => {
    const xml = bpmn(LANES, shapes, [
      ["F1", "A", "B", [[80, 50], [200, 50]]],
      ["F2", "B", "C", [[260, 50], [400, 50]]],
      ["F3", "C", "B", [[430, 80], [430, 90], [260, 90], [260, 50]]],
    ]);
    expect(sharedPorts(readDi(xml))).toEqual([["F3", "F2", "B"]]);
    expect(diagramFit(xml)["edge-shared-port"]!.map((f) => f.where)).toEqual(["F3+F2/B"]);
  });
  test("the same loop entering another side is clean, and two arrivals on one point are a join", () => {
    const xml = bpmn(LANES, shapes, [
      ["F1", "A", "B", [[80, 50], [200, 50]]],
      ["F2", "B", "C", [[260, 50], [400, 50]]],
      ["F3", "C", "B", [[430, 80], [430, 95], [230, 95], [230, 80]]],
      ["F4", "A", "C", [[50, 20], [50, 5], [400, 5], [400, 50]]],
    ]);
    expect(sharedPorts(readDi(xml))).toEqual([]);
  });
});
