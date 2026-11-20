/**
 * Ambient declaration for `dmn-moddle`, which ships no types for its entry
 * point — the same situation as `bpmn-moddle` next door, and handled the same
 * way and for the same reason.
 *
 * `fromXML` returns `unknown`. `src/workflow/decision-table.ts` states the
 * shapes it reads as its own interfaces and narrows into them, so a wrong guess
 * here cannot masquerade as a checked type at the call site.
 */
declare module "dmn-moddle" {
  export class DmnModdle {
    constructor(packages?: Record<string, unknown>);
    fromXML(xml: string): Promise<{
      rootElement: unknown;
      warnings: unknown[];
      elementsById: Record<string, unknown>;
    }>;
  }
}
