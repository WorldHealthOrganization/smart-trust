/**
 * Extract and inject the translatable text of a BPMN diagram.
 *
 * `schemas/library/translation-tools.ts` has declared a `bpmn` format for the DAK
 * content type since the translation work landed — "BPMN label translation.
 * Diagram is re-rendered after text injection to handle text overflow in
 * translated labels" — with **no `extractModule` and no `injectModule`**, and
 * no code behind it anywhere. The declaration was the whole implementation.
 * This is the extract/inject half; `scripts/render-bpmn.ts` is the re-render.
 *
 * ## What is translatable, and what is emphatically not
 *
 * Translatable: the `name` attribute of a process, lane, activity, global
 * task, gateway, event or sequence flow, and the text of a `<documentation>`
 * element. These
 * are the strings a reader sees in the rendered diagram.
 *
 * NOT translatable, and the reason each would break something:
 *
 *   - `id` and every reference to one (`sourceRef`, `targetRef`,
 *     `calledElement`, `bpmnElement`, `flowNodeRef`). Translating an id
 *     silently disconnects the graph — `workflow_next` would report a flow
 *     pointing at a node that no longer exists.
 *   - `<bootstrap.processes:skill ref>`, `<cat-harness.processes:bean op>`, `<cat-harness.processes:policy>`. A translated
 *     skill ref resolves to nothing, which is the exact defect
 *     `check:workflow-refs` exists to catch — a translation pass must not
 *     manufacture the thing another gate is there to prevent.
 *   - Anything under `<bpmndi:BPMNDiagram>`: coordinates and shape bounds.
 *
 * ## On the authored line breaks
 *
 * Labels here carry hand-placed `&#10;` breaks, tuned so the text sits well
 * in a 140x80 task box. A translator receiving the msgid has no reason to
 * reproduce them, so the msgid is offered with the breaks turned into
 * spaces — and MEASURED, 2026-09-18, that costs nothing: rendering a French
 * set ~18% longer with every authored break dropped produced the same 3
 * lines occupying 42px of the 80px box, because bpmn-js re-wraps regardless.
 * The breaks are not load-bearing. If a future diagram does overflow, the
 * fix is the shape bounds, not the string.
 */
import type { PotEntry } from "./pot-extract.js";

/** Elements whose `name` a reader sees. Everything else is structure. */
const NAMED = new RegExp(
  "<(?:bpmn:)?(?:process|lane|task|serviceTask|userTask|manualTask|scriptTask|" +
    "sendTask|receiveTask|businessRuleTask|callActivity|subProcess|" +
    // BPMN 2.0's global tasks: a layer's shared steps, named once in the
    // file that holds no process (owner, 2026-10-20, "a1").
    "globalTask|globalUserTask|globalScriptTask|globalManualTask|globalBusinessRuleTask|" +
    "startEvent|endEvent|intermediateCatchEvent|intermediateThrowEvent|boundaryEvent|" +
    "exclusiveGateway|parallelGateway|inclusiveGateway|eventBasedGateway|" +
    "sequenceFlow|participant|collaboration|" +
    // Stores are drawn as data stores, not lanes (owner, 2026-11-01, Q-BR-3 A),
    // and a reader sees their names on the diagram.
    "dataStore|dataStoreReference|dataObjectReference)\\b[^>]*?\\sname=\"([^\"]*)\"",
  "g",
);

const DOCUMENTATION = /<(?:bpmn:)?documentation>([\s\S]*?)<\/(?:bpmn:)?documentation>/g;

/** `&#10;` and friends → the text a translator should actually see. */
export function decodeLabel(raw: string): string {
  return raw
    .replace(/&#10;|&#xA;/gi, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** The inverse, for writing a translated string back into an attribute. */
export function encodeAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function encodeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 1-based line number of a character offset. */
function lineAt(xml: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < xml.length; i++) if (xml[i] === "\n") line++;
  return line;
}

/**
 * Translatable strings of one diagram, in document order, de-duplicated by
 * msgid — a label repeated across two diagrams is one translation, which is
 * the point of gettext.
 */
export function extractBpmn(xml: string, sourcePath: string): PotEntry[] {
  const entries: PotEntry[] = [];
  const seen = new Set<string>();

  const push = (raw: string, index: number, comment: string) => {
    const msgid = decodeLabel(raw);
    if (!msgid || seen.has(msgid)) return;
    // A bare id or a number is not prose; it reaches here when someone uses
    // an id as a label, and translating it would be nonsense.
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(msgid) && /_/.test(msgid)) return;
    seen.add(msgid);
    entries.push({ source: sourcePath, line: lineAt(xml, index), msgid, kind: "bpmn-label", comment });
  };

  for (const m of xml.matchAll(NAMED)) {
    push(m[1], m.index ?? 0, "Diagram label");
  }
  for (const m of xml.matchAll(DOCUMENTATION)) {
    push(m[1], m.index ?? 0, "Diagram element documentation");
  }
  return entries;
}

/**
 * Write translations back, returning the localised BPMN.
 *
 * A msgid with no translation keeps its source text — a half-translated
 * diagram is the correct outcome of a half-finished PO, and blanking the
 * label instead would lose the diagram rather than leave it partly English.
 */
export function injectBpmn(xml: string, translations: Map<string, string>): string {
  let out = xml.replace(NAMED, (whole, raw: string) => {
    const hit = translations.get(decodeLabel(raw));
    if (!hit) return whole;
    // Replace only within the matched `name="…"`, never elsewhere in the tag:
    // an id or a ref could coincidentally hold the same characters.
    return whole.replace(`name="${raw}"`, `name="${encodeAttr(hit)}"`);
  });

  out = out.replace(DOCUMENTATION, (whole, body: string) => {
    const hit = translations.get(decodeLabel(body));
    if (!hit) return whole;
    const open = whole.slice(0, whole.indexOf(">") + 1);
    const close = whole.slice(whole.lastIndexOf("</"));
    return `${open}${encodeText(hit)}${close}`;
  });

  return out;
}
