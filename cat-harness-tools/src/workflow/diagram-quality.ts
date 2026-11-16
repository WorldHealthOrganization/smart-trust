/**
 * Readability criteria for a BPMN diagram: structure a reader can follow and
 * a drawing that does not tangle.
 *
 * Owner, 2026-10-31 (thread "Improve BPMN quality checks from research"):
 * review the evidence-based BPMN guidance (7PMG, the labeling study, the
 * process-model comprehension literature) and make mechanical checks of what
 * holds up. The analysis kept these and dropped the rest:
 *
 * | criterion | basis |
 * |---|---|
 * | `activity-implicit-split` | a task with two ways out leaves AND vs XOR to the reader (Leopold, Mendling, Günther 2016) |
 * | `gateway-mixed` | 7PMG G2 and G4: one gateway both joining and splitting |
 * | `process-size` | the house rule (split past 20 nodes); stricter than the evidence and says so |
 * | `process-decompose` | 7PMG G7: above 50 elements, error probability tends to exceed 50% |
 * | `process-single-start` | 7PMG G3, start half only: several named END events are this corpus's design |
 * | `decision-label-question` | a decision names the question its branches answer |
 * | `activity-label-verb-first` | 7PMG G6, verb-object labels; a heuristic, since the evidence is perceived ambiguity |
 * | `edge-rectilinear` · `edge-crossing` · `edge-through-node` | owner rule 2026-09-23, "keep rectilinear if possible, no overlapping" |
 *
 * Not checked, because the evidence does not support them: a left-to-right
 * direction (Figl & Strembeck 2015 found no difference), a gateway fan-out
 * cap, a label word cap, one end event, a colour palette. An OR-join needs no
 * criterion: `process-model.ts` refuses inclusive gateways at load.
 *
 * The tangle geometry is `src/diagram/segment-geometry.ts`, shared with
 * `archimate-crossings.ts`, so a BPMN crossing and an ArchiMate crossing are
 * the same question.
 *
 * Lives here, not in `scripts/kg-audit.ts`, for the reason `reachability.ts`
 * gives: that script runs at import, so a test cannot import it.
 *
 * @module cat-harness-tools/src/workflow/diagram-quality
 */
import { XMLParser } from "fast-xml-parser";
import { segmentThroughBox, segmentsCross, segmentsOf, type Box, type Pt } from "../diagram/segment-geometry.js";
import { isActivity, isDecision, type ProcessModel } from "./process-model.js";

export interface QualityFinding {
  where: string;
  detail: string;
}

/** Where the diagram drew each element: shapes and edge waypoints, keyed by `bpmnElement`. */
export interface DiagramLayout {
  shapes: Map<string, Box>;
  edges: Map<string, Pt[]>;
}

/** Above this many flow nodes, split the process by phase (house rule, `bpmn-authoring`). */
export const SPLIT_PAST = 20;
/** 7PMG G7: decompose a model with more than 50 elements. */
export const DECOMPOSE_PAST = 50;
/** A segment that moves more than this in both x and y is diagonal. */
const SLACK = 1;

const asArray = (v: unknown): unknown[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Read the DI layout of a `.bpmn` file. A diagram with no DI gives empty maps. */
export function readLayout(xml: string): DiagramLayout {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", removeNSPrefix: true });
  const doc: unknown = parser.parse(xml);
  const at = (n: unknown, k: string): unknown => (n && typeof n === "object" ? (n as Record<string, unknown>)[k] : undefined);
  const shapes = new Map<string, Box>();
  const edges = new Map<string, Pt[]>();
  for (const diagram of asArray(at(at(doc, "definitions"), "BPMNDiagram"))) {
    for (const plane of asArray(at(diagram, "BPMNPlane"))) {
      for (const s of asArray(at(plane, "BPMNShape"))) {
        const id = at(s, "bpmnElement"), b = at(s, "Bounds");
        if (typeof id !== "string" || !b) continue;
        shapes.set(id, { x: Number(at(b, "x")), y: Number(at(b, "y")), w: Number(at(b, "width")), h: Number(at(b, "height")) });
      }
      for (const e of asArray(at(plane, "BPMNEdge"))) {
        const id = at(e, "bpmnElement");
        if (typeof id !== "string") continue;
        edges.set(id, asArray(at(e, "waypoint")).map((w) => ({ x: Number(at(w, "x")), y: Number(at(w, "y")) })));
      }
    }
  }
  return { shapes, edges };
}

/**
 * Verbs that end like a noun. A first word with a noun ending (`-ing`,
 * `-tion`, `-ment`, `-ance`, …) is reported unless it is one of these.
 */
const VERBS_WITH_NOUN_ENDINGS = new Set([
  "bring", "string", "ring", "sing", "swing",
  "mention", "question", "position", "function", "partition", "section", "caption", "condition",
  "provision", "commission", "petition", "station", "sanction", "version", "motion", "auction",
  "implement", "document", "comment", "augment", "supplement", "complement", "segment",
  "balance", "advance", "enhance", "reference", "sequence", "influence", "silence", "evidence",
  "licence", "license", "finance", "distance", "experience", "sentence", "fence", "commence",
]);
const NOUN_ENDING = /(ing|tion|sion|ment|ance|ence)$/;

/** The first word of a label, lower-cased, or undefined for an empty label. */
function firstWord(name: string): string | undefined {
  const w = name.trim().split(/\s+/)[0];
  return w ? w.toLowerCase().replace(/[^a-z-]/g, "") : undefined;
}

/** Every readability criterion for one process, as findings lists keyed by criterion id. */
export function diagramQuality(m: ProcessModel, layout?: DiagramLayout): Record<string, QualityFinding[]> {
  const nodes = [...m.nodes.values()];
  const out: Record<string, QualityFinding[]> = {
    "activity-implicit-split": [],
    "gateway-mixed": [],
    "process-size": [],
    "process-decompose": [],
    "process-single-start": [],
    "decision-label-question": [],
    "activity-label-verb-first": [],
    "edge-rectilinear": [],
    "edge-crossing": [],
    "edge-through-node": [],
  };

  for (const n of nodes) {
    if (isActivity(n) && n.outgoing.length > 1) {
      out["activity-implicit-split"]!.push({
        where: n.id,
        detail:
          `${n.outgoing.length} sequence flows leave "${n.name}" with no gateway, so a reader must guess whether ` +
          `they run in parallel or one is chosen. Put an exclusive or parallel gateway after the task.`,
      });
    }
    if ((n.kind === "exclusive" || n.kind === "parallel") && n.incoming.length > 1 && n.outgoing.length > 1) {
      out["gateway-mixed"]!.push({
        where: n.id,
        detail: `${n.incoming.length} flows in and ${n.outgoing.length} out: one gateway both joins and splits. Use a join, then a split.`,
      });
    }
    if (isDecision(n) && n.name.trim() && !n.name.includes("?")) {
      out["decision-label-question"]!.push({
        where: n.id,
        detail: `decision "${n.name}" is not phrased as a question; its branches are the answers.`,
      });
    }
    if (isActivity(n)) {
      const w = firstWord(n.name);
      if (w && NOUN_ENDING.test(w) && !VERBS_WITH_NOUN_ENDINGS.has(w)) {
        out["activity-label-verb-first"]!.push({
          where: n.id,
          detail: `"${n.name}" starts with "${w}", which reads as a noun or gerund. Start with an imperative verb, then its object (verb-object).`,
        });
      }
    }
  }

  const size = nodes.length;
  if (size > SPLIT_PAST) {
    out["process-size"]!.push({
      where: m.id,
      detail: `${size} flow nodes, past the ${SPLIT_PAST} at which bpmn-authoring asks for a split by phase into call activities.`,
    });
  }
  if (size > DECOMPOSE_PAST) {
    out["process-decompose"]!.push({
      where: m.id,
      detail: `${size} flow nodes, past 7PMG's ${DECOMPOSE_PAST} (G7), above which error probability tends to exceed 50%.`,
    });
  }
  if (m.startNodes.length > 1) {
    out["process-single-start"]!.push({
      where: m.id,
      detail: `${m.startNodes.length} start events (${m.startNodes.join(", ")}). One entry point per process level, or a call activity per entry.`,
    });
  }

  if (layout) {
    const routed = [...m.flows.keys()]
      .map((id) => ({ id, flow: m.flows.get(id)!, pts: layout.edges.get(id) ?? [] }))
      .filter((r) => r.pts.length >= 2);
    for (const r of routed) {
      if (segmentsOf(r.pts).some(([a, b]) => Math.abs(a.x - b.x) > SLACK && Math.abs(a.y - b.y) > SLACK)) {
        out["edge-rectilinear"]!.push({ where: r.id, detail: `flow ${r.flow.from} → ${r.flow.to} has a diagonal segment; turn at right angles.` });
      }
    }
    for (let i = 0; i < routed.length; i++) {
      for (let j = i + 1; j < routed.length; j++) {
        const a = routed[i]!, b = routed[j]!;
        const hit = segmentsOf(a.pts).some(([p1, p2]) => segmentsOf(b.pts).some(([p3, p4]) => segmentsCross(p1, p2, p3, p4)));
        if (hit) out["edge-crossing"]!.push({ where: `${a.id}×${b.id}`, detail: `flows ${a.id} and ${b.id} cross.` });
      }
    }
    for (const r of routed) {
      for (const n of nodes) {
        if (n.id === r.flow.from || n.id === r.flow.to) continue;
        const box = layout.shapes.get(n.id);
        if (!box) continue;
        if (segmentsOf(r.pts).some(([p1, p2]) => segmentThroughBox(p1, p2, box))) {
          out["edge-through-node"]!.push({ where: r.id, detail: `flow ${r.flow.from} → ${r.flow.to} runs over "${n.name || n.id}", which it does not connect.` });
        }
      }
    }
  }
  return out;
}

/** Criteria that need a drawing: `n/a` when the diagram has no DI. */
export const LAYOUT_CRITERIA = new Set(["edge-rectilinear", "edge-crossing", "edge-through-node"]);
