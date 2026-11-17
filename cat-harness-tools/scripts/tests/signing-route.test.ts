/**
 * The signing route — the branch is exhaustive, and everything it cannot name
 * goes to the human.
 *
 * Bean `folio-assistant-r0rq`. The route is a DMN table rather than code
 * because the policy is an editor's to change; these tests pin the two
 * properties that are NOT policy:
 *
 *  1. **the API row is unique** — reachable only with an endpoint configured
 *     and reach `internet` or `egress-restricted`, and both facts are
 *     load-bearing;
 *  2. **every other combination routes to a person**, including `unknown` and
 *     including values not yet in the table.
 *
 * Property 2 is the one worth a test rather than a reading. A gateway that
 * sent "could not determine" to the API would fail closed on the wire and
 * OPEN IN THE RECORD: the call fails and what survives is an unsigned report
 * with nothing saying it is unsigned.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "path";

import { evaluate, loadDecisionTable, possibleOutcomes } from "../../src/workflow/decision-table";
import { loadProcessModel } from "../../src/workflow/process-model";
import { REACH_UNKNOWN, effectiveReach } from "../../schemas/process/actor-reach.ts";
import { NETWORK_REACHES } from "../../schemas/kg/cat-harness.ts";
import { fulfilmentKindsForBpmnType } from "../../schemas/process/role-graph.ts";
import { workflowFile } from "../known-skills.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

/** The harness root; diagrams are found by NAME through its declared `processes` graphs (bean `63wl`). */
const HARNESS = resolve(HARNESS_ROOT);

const table = () => loadDecisionTable(workflowFile(HARNESS, "signing-route.dmn"), "Decision_SigningRoute");

/** Every fact combination a real run can present, including the third state. */
const REACHES = [...NETWORK_REACHES, REACH_UNKNOWN] as const;
const CONFIGURED = [true, false] as const;

describe("the signing route table", () => {
  test("it offers exactly the two routes the diagram draws", async () => {
    expect(possibleOutcomes(await table()).sort()).toEqual(["api", "human"]);
  });

  test("the API is reached only from internet or egress-restricted reach with an endpoint configured", async () => {
    const t = await table();
    const api: string[] = [];
    for (const reach of REACHES) {
      for (const signingApiConfigured of CONFIGURED) {
        if (evaluate(t, { reach, signingApiConfigured }).outcome === "api") {
          api.push(`${reach}/${signingApiConfigured}`);
        }
      }
    }
    expect(api.sort()).toEqual(["egress-restricted/true", "internet/true"]);
  });

  test("both facts are load-bearing — neither alone decides", async () => {
    const t = await table();
    // Reach permits, configuration does not.
    expect(evaluate(t, { reach: "internet", signingApiConfigured: false }).outcome).toBe("human");
    // Configuration exists, reach does not permit.
    expect(evaluate(t, { reach: "air-gapped", signingApiConfigured: true }).outcome).toBe("human");
  });

  test("unknown reach goes to the human even with an endpoint configured", async () => {
    const t = await table();
    expect(evaluate(t, { reach: REACH_UNKNOWN, signingApiConfigured: true }).outcome).toBe("human");
  });

  test("a reach value the table does not name still routes to a person", async () => {
    // The catch-all row. A value added to NETWORK_REACHES without a row here
    // must degrade into a slower signature, never into an unsigned report.
    const t = await table();
    expect(evaluate(t, { reach: "satellite-uplink", signingApiConfigured: true }).outcome)
      .toBe("human");
  });

  test("every combination is decided — no run reaches the gateway with no answer", async () => {
    const t = await table();
    for (const reach of REACHES) {
      for (const signingApiConfigured of CONFIGURED) {
        const { outcome } = evaluate(t, { reach, signingApiConfigured });
        expect(["api", "human"]).toContain(String(outcome));
      }
    }
  });
});

describe("the table and effectiveReach agree about the undeclared case", () => {
  test("an undeclared actor in a connected deployment does not reach the API", async () => {
    // The two halves are separate mechanisms — a schema function and an
    // editable table — so this asserts the JOIN rather than either side. It
    // is the owner's case end to end: a connected site holding an isolated
    // signing host, with nothing declared about that host.
    const t = await table();
    const reach = effectiveReach("internet", undefined);
    expect(reach).toBe(REACH_UNKNOWN);
    expect(evaluate(t, { reach, signingApiConfigured: true }).outcome).toBe("human");
  });

  test("a declared air-gapped actor in a connected deployment takes the human route", async () => {
    const t = await table();
    const reach = effectiveReach("internet", "air-gapped");
    expect(evaluate(t, { reach, signingApiConfigured: true }).outcome).toBe("human");
  });
});

describe("the diagram the table backs", () => {
  test("the gateway's branches are the table's outcomes", async () => {
    // loadProcessModel refuses an outcome with no matching branch; loading the
    // real diagram is what exercises that against this table rather than a
    // fixture.
    const m = await loadProcessModel(workflowFile(HARNESS, "qa-report-signing.bpmn"));
    const gw = m.nodes.get("Gateway_SigningRoute");
    expect(gw?.decisionRef).toContain("signing-route.dmn#Decision_SigningRoute");
  });

  test("the human lane is a userTask — a system actor cannot fill it", async () => {
    // The enforcement that stops the air-gapped route quietly becoming a
    // second machine route. If this task were a serviceTask the diagram would
    // still be valid BPMN and the feature would be gone.
    const m = await loadProcessModel(workflowFile(HARNESS, "qa-report-signing.bpmn"));
    const human = m.nodes.get("Task_HumanSign");
    const api = m.nodes.get("Task_ApiSign");
    // Asserted through the function that ENFORCES it, not through the type
    // string: the string is only evidence, the exclusion is the feature.
    expect(fulfilmentKindsForBpmnType(human!.type)).not.toContain("system");
    expect(fulfilmentKindsForBpmnType(api!.type)).toContain("system");
  });
});
