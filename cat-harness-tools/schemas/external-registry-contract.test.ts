/**
 * The `external-registry` role held to its contract,
 * `skills/kg/kg-core/external-registry-contract.md`.
 *
 * The registry is played by a party this layer does not run, so what a test
 * here can hold is the side of the contract that is ours: which lane relies on
 * the registry, and what the verifier does when the registry does not answer.
 * The contract says so itself ("This side of the contract is ours, and it is
 * what makes relying on a party we do not control safe").
 *
 * What cannot run here, and is therefore not claimed: lines 1 and 2 of "What
 * it must do" — publishing the GDHCN trustlist and serving a slice by its
 * hierarchical path. They are the registry's own behaviour, on a network this
 * container cannot reach (`kg-to-portal`: the endpoints are "transcribed, not
 * fetched").
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { XMLParser } from "fast-xml-parser";

import { requireHarnessRoot } from "./harness-root.ts";
const ROOT = requireHarnessRoot();

interface Role { id: string; actorKinds: string[]; skills: string[] }
// declared-path-literal: a contract test whose subject IS these named nodes — the role,
// actor, capabilities and requirement set one external party's contract is made of.
const role = JSON.parse(readFileSync(join(ROOT, "scenarios/roles.json"), "utf-8")).roles.find((r: Role) => r.id === "external-registry") as Role;

type Node = Record<string, unknown>;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", removeNSPrefix: true, isArray: (_name: string, _path: unknown, _leaf: boolean, isAttribute: boolean) => !isAttribute });

/** Every element named `name` anywhere under `n`. */
function all(n: unknown, name: string, out: Node[] = []): Node[] {
  if (Array.isArray(n)) for (const x of n) all(x, name, out);
  else if (n && typeof n === "object") {
    for (const [k, v] of Object.entries(n as Node)) {
      if (k === name) for (const x of v as Node[]) out.push(x);
      if (!k.startsWith("@")) all(v, name, out);
    }
  }
  return out;
}
const text = (n: Node, name: string): string => {
  const v = (n[name] as unknown[] | undefined)?.[0];
  return typeof v === "string" ? v : String((v as Node | undefined)?.["#text"] ?? "");
};

function bpmnFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? bpmnFiles(p) : f.endsWith(".bpmn") ? [p] : [];
  });
}

// declared-path-literal: a contract test whose subject IS these named nodes — the role,
// actor, capabilities and requirement set one external party's contract is made of.
const doc = parser.parse(readFileSync(join(ROOT, "processes/kg/kg-to-portal.bpmn"), "utf-8"));
const lanes = all(doc, "lane");
const portal = lanes.find((l) => l["@partitionElementRef"] === "external-registry")!;
const flows = all(doc, "sequenceFlow");
const flowNodeRefs = (lane: Node) => ((lane["flowNodeRef"] as unknown[]) ?? []).map((r) => String(typeof r === "string" ? r : (r as Node)["#text"]).trim());

describe("the role is played by an external party, and its contract is a skill it carries", () => {
  test("actorKinds is external only, and it carries external-registry-contract", () => {
    expect(role.actorKinds).toEqual(["external"]);
    expect(role.skills).toContain("external-registry-contract");
  });
});

describe("Where the diagrams lean on it: one lane, Lane_Portal in kg-to-portal, holding P_Verify and GW_Verified", () => {
  test("in this repository's processes exactly one lane names the role, through partitionElementRef", () => {
    const naming = bpmnFiles(join(ROOT, "processes")).flatMap((f) =>
      all(parser.parse(readFileSync(f, "utf-8")), "lane")
        .filter((l) => l["@partitionElementRef"] === "external-registry")
        .map((l) => `${f.slice(ROOT.length + 1)}#${l["@id"]}`),
    );
    expect(naming).toEqual(["processes/kg/kg-to-portal.bpmn#Lane_Portal"]);
  });

  test("the role is declared as a top-level resource, and the lane holds P_Verify and GW_Verified", () => {
    expect(all(doc, "resource").some((r) => r["@id"] === "external-registry")).toBe(true);
    expect(flowNodeRefs(portal)).toEqual(expect.arrayContaining(["P_Verify", "GW_Verified"]));
  });
});

describe("What the verifier does when the contract is not met: never a pass", () => {
  const out = flows.filter((f) => f["@sourceRef"] === "GW_Verified");
  const gateway = all(doc, "exclusiveGateway").find((g) => g["@id"] === "GW_Verified")!;

  test("GW_Verified serves the bytes on exactly one branch, the match, and has no default", () => {
    const served = out.filter((f) => f["@targetRef"] === "End_Served");
    expect(served).toHaveLength(1);
    expect(served[0]!["@name"]).toBe("signature and digests match");
    expect(gateway["@default"]).toBeUndefined();
  });

  test("every other branch goes to End_Rejected, which serves the previous version", () => {
    const rest = out.filter((f) => f["@targetRef"] !== "End_Served");
    expect(rest.length).toBeGreaterThan(0);
    for (const f of rest) expect(f["@targetRef"]).toBe("End_Rejected");
    const end = all(doc, "endEvent").find((e) => e["@id"] === "End_Rejected")!;
    expect(String(end["@name"])).toMatch(/serve the previous version/);
  });

  test("the lane states that an unreachable registry is `unknown`, routed as a mismatch, never a guessed pass", () => {
    const said = text(portal, "documentation").replace(/\s+/g, " ");
    expect(said).toMatch(/cannot be reached, this lane's answer is `unknown`/);
    expect(said).toMatch(/routes it the same way as a mismatch/);
    expect(said).toMatch(/never to a guessed pass/);
  });
});
