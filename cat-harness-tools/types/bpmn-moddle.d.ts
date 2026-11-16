/**
 * Ambient declaration for `bpmn-moddle`.
 *
 * The package exports its entry point (`.`) as plain JavaScript with no types
 * attached; the generated declarations it ships live under the `./types`
 * subpath and cover only the BPMN *element* interfaces, not the `BpmnModdle`
 * class itself. So the class needs declaring here regardless.
 *
 * `fromXML` deliberately returns `unknown`. Using the generated element types
 * would mean threading `ModdleElement<T>` generics through the parser for no
 * gain: the parts this repo actually reads include `folio:skill` and
 * `folio:bean`, which are a custom namespace and arrive as untyped moddle
 * elements either way. `src/workflow/process-model.ts` states the shapes it
 * reads as its own interfaces and narrows into them, so a wrong guess cannot
 * masquerade as a checked type at the call site.
 */
declare module "bpmn-moddle" {
  export class BpmnModdle {
    constructor(packages?: Record<string, unknown>);
    fromXML(xml: string): Promise<{
      rootElement: unknown;
      warnings: unknown[];
      elementsById: Record<string, unknown>;
    }>;
  }
}
