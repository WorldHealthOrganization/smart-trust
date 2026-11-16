/**
 * PROV-JSONLD emission: the falsifier for beans `jcet` / `9y9j` is a real
 * processor — expand what we emit and see links where PROV-O says nodes.
 *
 * The tests of this file that read the whole checkout (reads who-iris's IRIS
 * catalogue) live in `test/prov-jsonld-checkout.test.ts` (bean `7zz1`):
 * standing alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import jsonld from "jsonld";

import { localLoader } from "../scripts/publish-verify.ts";
import {
  addressBook,
  heldProvJsonldContext,
  processHolding,
  provJsonldDocument,
  PROV_JSONLD_CONTEXT_URL,
  type AddressBook,
} from "./kg/prov-jsonld.ts";
import { agreementDistribution, grantCredential, stampProvDecisionRecord, type ProvActivity } from "./content/prov.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { dirname } from "node:path";
import { harnessRel } from "../scripts/lib/harness-layout.ts";

const REPO = resolve(dirname(HARNESS_ROOT));
const P = "http://www.w3.org/ns/prov#";

const activity = (agent: string, role: string, plan: string): ProvActivity =>
  ({
    "@type": "prov:Activity",
    "@id": "t--x#1",
    "prov:startedAtTime": "2026-10-01T00:00:00.000Z",
    "prov:qualifiedAssociation": { "prov:agent": agent, "prov:hadRole": role, "prov:hadPlan": plan },
    "cat-harness:underPolicy": "https://litlfred.github.io/folio-assistant/policies/folio-defaults",
  }) as ProvActivity;

async function expanded(doc: object): Promise<Record<string, unknown>[]> {
  const top = (await jsonld.expand(doc, { documentLoader: localLoader(REPO) } as never)) as unknown as Record<string, unknown>[];
  return top.flatMap((n) => (n["@graph"] as Record<string, unknown>[] | undefined) ?? [n]);
}

describe("the held PROV-JSONLD context", () => {
  test("matches its pinned sha256, and is the JSON-LD 1.1 context it claims to be", () => {
    const ctx = heldProvJsonldContext(REPO) as { "@context": Record<string, unknown> };
    expect(ctx["@context"]["@version"]).toBe(1.1);
    expect(ctx["@context"]["prov"]).toBe(P);
  });
});

describe("provJsonldDocument — a real checkout's actors, roles and plans", () => {
  const book = addressBook(REPO);

  test("agent, role and plan expand to LINKS at their release addresses, not literals", async () => {
    // cat-harness declares an iriBase; owner, authoring-agent and
    // code-change-review are all its own.
    const { document, unaddressed } = provJsonldDocument("t--x", [activity("owner", "authoring-agent", "code-change-review#Task_ClaimBean")], book);
    expect(unaddressed).toEqual([]);
    const nodes = await expanded(document);
    const assoc = nodes.find((n) => (n["@type"] as string[] | undefined)?.includes(`${P}Association`))!;
    expect(assoc[`${P}agent`]).toEqual([{ "@id": "https://litlfred.github.io/cat-harness/v0/scenarios/actors/owner" }]);
    expect(assoc[`${P}hadRole`]).toEqual([{ "@id": "https://litlfred.github.io/cat-harness/v0/scenarios/roles/authoring-agent" }]);
    expect(assoc[`${P}hadPlan`]).toEqual([
      // declared-path-literal: written in the sub-graph layout and answered in whichever the harness has — transitional (scripts/lib/harness-layout.ts, cat-harness#991 step 23; remove after cat-harness#1014 merges).
      { "@id": `https://litlfred.github.io/cat-harness/v0/${harnessRel("sdlc/processes")}/code-change-review/Task_ClaimBean` },
    ]);
  });

  test("the activity is joined to its association through @reverse prov:qualifiedAssociation", async () => {
    const { document } = provJsonldDocument("t--x", [activity("owner", "authoring-agent", "code-change-review#Task_ClaimBean")], book);
    const nodes = await expanded(document);
    const act = nodes.find((n) => (n["@type"] as string[] | undefined)?.includes(`${P}Activity`))!;
    expect(act["@id"]).toBe("https://litlfred.github.io/folio/t--x#1");
    expect(act[`${P}startedAtTime`]).toBeDefined();
    const assoc = nodes.find((n) => (n["@type"] as string[] | undefined)?.includes(`${P}Association`))!;
    expect(assoc["@reverse"]).toEqual({ [`${P}qualifiedAssociation`]: [{ "@id": "https://litlfred.github.io/folio/t--x#1" }] });
  });

  test("underPolicy's IRIs are links too", async () => {
    const nodes = await expanded(provJsonldDocument("t--x", [activity("owner", "authoring-agent", "code-change-review#T")], book).document);
    const act = nodes.find((n) => (n["@type"] as string[] | undefined)?.includes(`${P}Activity`))!;
    const key = Object.keys(act).find((k) => k.endsWith("/underPolicy"))!;
    expect(act[key]).toEqual([{ "@id": "https://litlfred.github.io/folio-assistant/policies/folio-defaults" }]);
  });

  test("an owner with no iriBase keeps the value a LITERAL and says why — never a relative IRI", async () => {
    // bootstrap-tools declares no iriBase, and holds render-kg-to-github-pages.bpmn
    // (it was large-datasets with sample-import.bpmn until bean `j7ql` folded
    // that diagram into cat-harness, which declares one).
    const { document, unaddressed } = provJsonldDocument("t--x", [activity("owner", "authoring-agent", "render-kg-to-github-pages#Task_Scope")], book);
    expect(unaddressed).toHaveLength(1);
    expect(unaddressed[0]).toMatchObject({ kind: "plan", value: "render-kg-to-github-pages#Task_Scope" });
    expect(unaddressed[0]!.why).toContain("declares no iriBase");
    const assoc = (await expanded(document)).find((n) => (n["@type"] as string[] | undefined)?.includes(`${P}Association`))!;
    expect(assoc[`${P}hadPlan`]).toEqual([{ "@value": "render-kg-to-github-pages#Task_Scope" }]);
  });

  test("an id nobody declares is unaddressed, with the reason", () => {
    const { unaddressed } = provJsonldDocument("t--x", [activity("nobody-at-all", "authoring-agent", "code-change-review#T")], book);
    expect(unaddressed.map((u) => [u.kind, u.why])).toEqual([["agent", 'no instance in this checkout declares actor "nobody-at-all"']]);
  });
});

describe("prov:used — catalogue items linked at their Handle (owner 2026-10-01, option A)", () => {
  const book = addressBook(REPO);
  const used = (items: string[]): ProvActivity =>
    ({ ...activity("owner", "authoring-agent", "code-change-review#T"), "prov:used": items }) as ProvActivity;

  test("an item nobody catalogues stays a literal, with the reason", async () => {
    const { document, unaddressed } = provJsonldDocument("t--x", [used(["item/not-catalogued"])], book);
    expect(unaddressed.map((u) => [u.kind, u.why])).toEqual([["entity", 'no instance in this checkout catalogues "item/not-catalogued"']]);
    const act = (await expanded(document)).find((n) => (n["@type"] as string[] | undefined)?.includes(`${P}Activity`))!;
    expect(act[`${P}used`]).toEqual([{ "@value": "item/not-catalogued" }]);
  });
});

describe("prov:wasInformedBy — a link to another activity (bean w1gy)", () => {
  test("each value is emitted as an @id link and expands to the PROV-O property", async () => {
    const stub: AddressBook = { resolve: () => ({ iri: "https://example.org/x" }) };
    const a = { ...activity("owner", "authoring-agent", "code-change-review#T"), "prov:wasInformedBy": ["https://example.org/step/0"] } as ProvActivity;
    const act = (await expanded(provJsonldDocument("t--i", [a], stub).document)).find((n) => (n["@type"] as string[] | undefined)?.includes(`${P}Activity`))!;
    expect(act[`${P}wasInformedBy`]).toEqual([{ "@id": "https://example.org/step/0" }]);
  });
});

describe("the context is named, never fetched", () => {
  test("documents reference the published URL and carry @base in their OWN context", () => {
    const stub: AddressBook = { resolve: () => ({ iri: "https://example.org/x" }) };
    const ctx = provJsonldDocument("t", [], stub).document["@context"] as unknown[];
    expect(ctx[0]).toBe(PROV_JSONLD_CONTEXT_URL);
    expect((ctx[1] as Record<string, unknown>)["@base"]).toBeDefined();
  });
});

describe("subject IRIs beside the release addresses (issue #959, owner 2026-10-30 option A)", () => {
  const book: AddressBook = {
    resolve: (kind, v) => ({ iri: `https://example.org/release/${kind}/${v}` }),
    subject: (kind, v) => (kind === "agent" ? undefined : `https://example.org/kg/${kind}/${v.replace("#", "/node/")}`),
  };

  test("plan and role subjects are links; the stored short reference stays the plan", async () => {
    const { document } = provJsonldDocument("t--s", [activity("owner", "merge-steward", "merge-train#Task_ReadLive")], book);
    const assoc = (document["@graph"] as Record<string, unknown>[]).find((n) => n["@type"] === "Association")!;
    expect(assoc.plan).toBe("https://example.org/release/plan/merge-train#Task_ReadLive");
    expect(assoc["cat-harness:planSubject"]).toBe("https://example.org/kg/plan/merge-train/node/Task_ReadLive");
    expect(assoc["cat-harness:roleSubject"]).toBe("https://example.org/kg/role/merge-steward");
    // No subject, no term: an agent with no page is not given an address.
    expect("cat-harness:agentSubject" in assoc).toBe(false);
    const node = (await expanded(document)).find((n) => Object.keys(n).some((k) => k.endsWith("planSubject")))!;
    const key = Object.keys(node).find((k) => k.endsWith("planSubject"))!;
    expect(node[key]).toEqual([{ "@id": "https://example.org/kg/plan/merge-train/node/Task_ReadLive" }]);
  });

  test("a book without subjects publishes only the release addresses", () => {
    const plain: AddressBook = { resolve: book.resolve };
    const { document } = provJsonldDocument("t--p", [activity("owner", "merge-steward", "merge-train#Task_ReadLive")], plain);
    const assoc = (document["@graph"] as Record<string, unknown>[]).find((n) => n["@type"] === "Association")!;
    expect(Object.keys(assoc).filter((k) => k.endsWith("Subject"))).toEqual([]);
  });
});

describe("processHolding — the process a task belongs to", () => {
  const xml = `<bpmn:definitions>
  <bpmn:collaboration id="C"><bpmn:participant id="P1" processRef="A"/></bpmn:collaboration>
  <bpmn:process id="A" isExecutable="false"><bpmn:task id="T1"/></bpmn:process>
  <bpmn:process id="B"><bpmn:userTask id="T2"/></bpmn:process>
</bpmn:definitions>`;
  test("each task resolves to its own process; unknown ids and ids outside any process to none", () => {
    expect(processHolding(xml, "T1")).toBe("A");
    expect(processHolding(xml, "T2")).toBe("B");
    expect(processHolding(xml, "nope")).toBeUndefined();
    expect(processHolding(xml, "P1")).toBeUndefined();
  });
});

describe("decision records cite agreement and grant with standard terms (bean yy40)", () => {
  const DCAT = "http://www.w3.org/ns/dcat#";
  const SPDX = "http://spdx.org/rdf/terms#";
  const CRED = "https://www.w3.org/2018/credentials#";
  const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
  const none: AddressBook = { resolve: () => ({ unaddressed: "test" }) };

  test("the agreement is a prov:used dcat:Distribution with spdx:checksum, the grant a VC; the hash chain is labelled a local extension", async () => {
    const rec = stampProvDecisionRecord({
      ...activity("owner", "authoring-agent", "code-change-review#T"),
      "prov:used": [
        agreementDistribution("https://example.org/dsa/v1#pdf", "a".repeat(64)),
        grantCredential("urn:uuid:7f1c2a52-6d1e-4b8e-9b0e-0c4b2b5d1a01"),
      ],
    });
    const { document } = provJsonldDocument("t--x", [rec], none);
    const nodes = await expanded(document);
    const act = nodes.find((n) => String(n["@id"]).endsWith("t--x#1"))!;
    const used = act[`${P}used`] as Record<string, unknown>[];
    const dist = used.find((u) => u["@id"] === "https://example.org/dsa/v1#pdf")!;
    expect(dist["@type"]).toEqual([`${P}Entity`, `${DCAT}Distribution`]);
    const sum = (dist[`${SPDX}checksum`] as Record<string, unknown>[])[0]!;
    expect(sum[`${SPDX}algorithm`]).toEqual([{ "@id": `${SPDX}checksumAlgorithm_sha256` }]);
    expect(sum[`${SPDX}checksumValue`]).toEqual([{ "@value": "a".repeat(64), "@type": "http://www.w3.org/2001/XMLSchema#hexBinary" }]);
    const vc = used.find((u) => u["@id"] === "urn:uuid:7f1c2a52-6d1e-4b8e-9b0e-0c4b2b5d1a01")!;
    expect(vc["@type"]).toEqual([`${P}Entity`, `${CRED}VerifiableCredential`]);
    // No agreement/grant term of our own anywhere in the expanded record
    expect(Object.keys(act).filter((k) => /agreement|grant/i.test(k))).toEqual([]);
    // Each hash-chain term is described in the graph as a local extension
    for (const term of ["previousHash", "recordHash"]) {
      const prop = nodes.find((n) => typeof n["@id"] === "string" && (n["@id"] as string).endsWith(term))!;
      expect(String((prop[`${RDFS}comment`] as { "@value": string }[])[0]!["@value"])).toMatch(/^Local extension/);
    }
  });
});
