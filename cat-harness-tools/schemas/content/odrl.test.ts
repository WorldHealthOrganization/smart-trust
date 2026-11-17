/**
 * ODRL 2.2 policies (issue #1180): the schema refuses what it cannot mean, the
 * migration moved every actor's permissions without losing or adding one, and
 * `permits()` answers three ways.
 */
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  ANYONE,
  FOLIO_DEFAULT_CONFLICT,
  HL7_PURPOSE_OF_USE,
  HL7_TERMINOLOGY_PACKAGE_ID,
  OdrlPolicySchema,
  actionGraph,
  broaderOrSelf,
  decide,
  decideWithConsent,
  effectiveRules,
  loadHl7PurposeOfUseFromActReason,
  permits,
  permitsWithConsent,
  readPolicies,
  readPolicyGrants,
  type ConsentEvaluator,
  type Decision,
  type OdrlOperator,
  type OdrlPolicy,
} from "./odrl.ts";
import { ProvActivitySchema } from "./prov.ts";
import { readActors, readPermissions } from "../process/role-graph.ts";
import { actorsDir } from "../process/role-graph.ts";
import { checkoutActors, checkoutPolicies } from "../process/scenario-overlay.ts";

import { requireHarnessRoot } from "../harness-root.ts";
const INSTANCE = requireHarnessRoot();
const REPO = resolve(INSTANCE, "..");
const POLICY_DIR = join(INSTANCE, "policies");
const ACTOR_DIR = actorsDir(REPO)!;

/**
 * Each actor's `permissions` list as the actor files carried it before the
 * migration (2026-09-23), copied from the files before they were edited.
 * The migration must reproduce it exactly: a permission lost or gained in a
 * file move is a permission change nobody decided.
 *
 * Two agent actors left this map with move M4 (2026-10-23): the evidence and
 * onboarding agents, which listed `content-authoring` here, moved up to the
 * dependent layer whose lanes they play, and their grants moved with them
 * into that layer's own `policies/`. The grant is unchanged; it is read
 * there, by the scenario overlay, not here.
 */
const BEFORE: Record<string, string[]> = {
  admin: ["admin-settings", "role-management", "release-authorization"],
  author: ["content-authoring"],
  "authoring-agent": ["content-authoring"],
  "board-renderer": [],
  "ci-health-watcher": ["qa-reporting"],
  "ci-pipeline": ["qa-reporting"],
  "clinical-sme": ["clinical-validation"],
  "content-reviewer": ["approval-authority", "adjudication"],
  "end-user": ["adjudication"],
  "ingestion-agent": ["content-authoring"],
  librarian: ["content-authoring"],
  "local-sweep": ["qa-reporting"],
  "platform-boundary-guard": ["qa-reporting"],
  "programme-manager": ["project-governance", "release-authorization"],
  "publication-manager": ["release-management"],
  "qc-reviewer": ["qa-reporting"],
  "review-agent": ["review-comments"],
  reviewer: ["review-comments"],
  "technical-officer": ["first-pass-review", "sme-coordination"],
  translator: ["translation"],
  "untainted-adjudicator": ["qa-reporting", "adjudication"],
  "untainted-checker": [],
};

const POLICIES = readPolicies(POLICY_DIR);
const DEFAULTS = [...POLICIES.values()][0]!;
const GRAPH = actionGraph(readPermissions(join(INSTANCE, "skills"))!.permissions);

function policy(over: Partial<OdrlPolicy> & Record<string, unknown> = {}): OdrlPolicy {
  return OdrlPolicySchema.parse({
    "@context": "http://www.w3.org/ns/odrl.jsonld",
    "@type": "Set",
    uid: "urn:test",
    profile: "urn:folio-odrl",
    ...over,
  });
}
const one = (p: OdrlPolicy) => new Map([[p.uid, p]]);

describe("the policies in this repository", () => {
  test("there is a policy, and it parses (vacuity guard)", () => {
    expect(POLICIES.size).toBeGreaterThan(0);
  });

  test("no actor file still carries its own permissions list", () => {
    const stale = readActors(ACTOR_DIR).filter((a) => a.permissions !== undefined).map((a) => a.id);
    expect(stale).toEqual([]);
  });

  test("the migration moved every permission, and added none", () => {
    const grants = readPolicyGrants(POLICY_DIR);
    const after = Object.fromEntries(
      readActors(ACTOR_DIR, grants)
        .filter((a) => a.id in BEFORE)
        .map((a) => [a.id, [...(a.permissions ?? [])].sort()]),
    );
    const before = Object.fromEntries(Object.entries(BEFORE).map(([k, v]) => [k, [...v].sort()]));
    expect(after).toEqual(before);
  });

  test("every assignee is an actor or anyone, and every action is in the profile", () => {
    const ids = new Set(readActors(ACTOR_DIR).map((a) => a.id));
    const { permission, prohibition } = effectiveRules(DEFAULTS, POLICIES);
    const bad = [...permission, ...prohibition].flatMap((r) => [
      ...(r.assignee === ANYONE || ids.has(r.assignee) ? [] : [`assignee ${r.assignee}`]),
      ...(GRAPH.has(r.action) ? [] : [`action ${r.action}`]),
    ]);
    expect(bad).toEqual([]);
  });

  test("in the checkout, every assignee of every instance's policy is an actor the checkout declares", () => {
    // A dependent that adds an actor writes its grants in its own policies/;
    // read alone, this layer sees neither, and the check above is the same.
    const all = checkoutPolicies(INSTANCE, POLICY_DIR);
    const ids = new Set(checkoutActors(INSTANCE, ACTOR_DIR).map((a) => a.id));
    const bad = [...all.values()].flatMap((p) =>
      [...p.permission, ...p.prohibition]
        .filter((r) => r.assignee !== ANYONE && !ids.has(r.assignee))
        .map((r) => `${p.uid}: ${r.assignee}`),
    );
    expect(bad).toEqual([]);
  });

  test("every profile action reaches odrl:use", () => {
    const stranded = [...GRAPH.keys()].filter((a) => !broaderOrSelf(a, GRAPH).has("odrl:use"));
    expect(stranded).toEqual([]);
  });

  test("an unauthenticated reader may visualize and render, and nothing else (owner, 2026-09-23)", () => {
    const anon = (action: string) => permits({ actor: null, action }, DEFAULTS, POLICIES, GRAPH);
    expect(anon("visualize")).toBe("permit");
    expect(anon("render")).toBe("permit");
    const others = [...GRAPH.keys()].filter((a) => !["visualize", "render"].includes(a) && !a.startsWith("odrl:"));
    expect(others.filter((a) => anon(a) === "permit")).toEqual([]);
  });

  test("a migrated grant still holds: admin may administer roles, author may not", () => {
    expect(permits({ actor: "admin", action: "role-management" }, DEFAULTS, POLICIES, GRAPH)).toBe("permit");
    expect(permits({ actor: "author", action: "role-management" }, DEFAULTS, POLICIES, GRAPH)).toBe("unknown");
  });
});

describe("permits(): three answers", () => {
  const g = actionGraph([
    { id: "perform-task", includedIn: ["odrl:execute"] },
    { id: "approve", includedIn: ["perform-task"] },
  ]);

  test("a grant of a broader action permits the actions included in it, not the reverse", () => {
    const broad = policy({ permission: [{ assignee: "a", action: "perform-task" }] });
    expect(permits({ actor: "a", action: "approve" }, broad, one(broad), g)).toBe("permit");
    const narrow = policy({ permission: [{ assignee: "a", action: "approve" }] });
    expect(permits({ actor: "a", action: "perform-task" }, narrow, one(narrow), g)).toBe("unknown");
  });

  test("no rule is unknown, never permit", () => {
    const p = policy();
    expect(permits({ actor: "a", action: "approve" }, p, one(p), g)).toBe("unknown");
  });

  test("a scoped grant holds only in its scope, and an unstated scope does not satisfy it", () => {
    const p = policy({
      permission: [
        {
          assignee: "a",
          action: "approve",
          constraint: [{ leftOperand: "cat-harness:process", operator: "odrl:eq", rightOperand: "release" }],
        },
      ],
    });
    const ask = (scope?: Record<string, string>) => permits({ actor: "a", action: "approve", scope }, p, one(p), g);
    expect(ask({ "cat-harness:process": "release" })).toBe("permit");
    expect(ask({ "cat-harness:process": "authoring" })).toBe("unknown");
    expect(ask()).toBe("unknown");
  });

  test("performing a task in a lane needs the lane's role as well as the permission", () => {
    const p = policy({ permission: [{ assignee: "a", action: "approve" }] });
    const ask = (roles: string[]) =>
      permits({ actor: "a", actorRoles: roles, action: "approve", scope: { "cat-harness:role": "reviewer" } }, p, one(p), g);
    expect(ask(["reviewer"])).toBe("permit");
    expect(ask(["author"])).toBe("deny");
    expect(ask([])).toBe("permit"); // no roles declared = unconstrained (ActorDef.roles)
  });

  test("the default conflict strategy is prohibit — a ruled profile departure from ODRL's invalid (bean jcet)", () => {
    // ODRL 2.2 §2.10 defaults to invalid; the owner ruled 2026-10-01 to keep
    // prohibit. A change here is a policy decision: update the ruling, the
    // comment on FOLIO_DEFAULT_CONFLICT and methodologies/odrl-policies.md too.
    expect(FOLIO_DEFAULT_CONFLICT).toBe("odrl:prohibit");
  });

  test("permission and prohibition together: prohibit by default, perm when the policy says so, invalid voids", () => {
    const rules = {
      permission: [{ assignee: "a", action: "approve" }],
      prohibition: [{ assignee: "a", action: "approve" }],
    };
    const ask = (p: OdrlPolicy) => permits({ actor: "a", action: "approve" }, p, one(p), g);
    expect(ask(policy(rules))).toBe("deny");
    expect(ask(policy({ ...rules, conflict: "odrl:perm" }))).toBe("permit");
    expect(ask(policy({ ...rules, conflict: "odrl:invalid" }))).toBe("deny");
  });

  test("an includedIn cycle does not hang, and the graph need not have one root", () => {
    const cyc = actionGraph([
      { id: "x", includedIn: ["y"] },
      { id: "y", includedIn: ["x", "odrl:use"] },
    ]);
    expect([...broaderOrSelf("x", cyc)].sort()).toEqual(["odrl:use", "x", "y"]);
    // Several roots: "p" sits under two actions that are under nothing, beside
    // ODRL's own root odrl:use. Each root reaches only itself.
    const forest = actionGraph([
      { id: "p", includedIn: ["r1", "r2"] },
      { id: "r1", includedIn: [] },
      { id: "r2", includedIn: [] },
    ]);
    expect([...broaderOrSelf("p", forest)].sort()).toEqual(["p", "r1", "r2"]);
    expect([...broaderOrSelf("r1", forest)]).toEqual(["r1"]);
    expect([...broaderOrSelf("r2", forest)]).toEqual(["r2"]);
    expect([...broaderOrSelf("odrl:use", forest)]).toEqual(["odrl:use"]);
  });

  test("inheritFrom brings the parent's rules; a dangling one throws", () => {
    const parent = policy({ uid: "urn:parent", permission: [{ assignee: "a", action: "approve" }] });
    const child = policy({ uid: "urn:child", inheritFrom: ["urn:parent"] });
    const all = new Map([
      [parent.uid, parent],
      [child.uid, child],
    ]);
    expect(permits({ actor: "a", action: "approve" }, child, all, g)).toBe("permit");
    const orphan = policy({ uid: "urn:orphan", inheritFrom: ["urn:nowhere"] });
    expect(() => effectiveRules(orphan, one(orphan))).toThrow(/not declared/);
  });
});

describe("the schema refuses what it cannot mean", () => {
  const bad = (v: Record<string, unknown>) => OdrlPolicySchema.safeParse({
    "@context": "x", "@type": "Set", uid: "u", profile: "p", ...v,
  }).success;

  test("an unknown key on a rule is refused, not dropped", () => {
    expect(bad({ permission: [{ assignee: "a", action: "b", remedy: [] }] })).toBe(false);
    expect(bad({ permission: [{ assignee: "a", action: "b", duty: [] }] })).toBe(false);
  });
  test("an Agreement names both its assigner and its assignee (ODRL 2.2 §2.1.3)", () => {
    expect(bad({ "@type": "Agreement" })).toBe(false);
    expect(bad({ "@type": "Agreement", assigner: "org:x" })).toBe(false);
    expect(bad({ "@type": "Agreement", assignee: "org:y" })).toBe(false);
    expect(bad({ "@type": "Agreement", assigner: "org:x", assignee: "org:y" })).toBe(true);
  });
  test("isAnyOf takes a list and eq takes one value", () => {
    const c = (operator: string, rightOperand: unknown) =>
      bad({ permission: [{ assignee: "a", action: "b", constraint: [{ leftOperand: "cat-harness:task", operator, rightOperand }] }] });
    expect(c("odrl:isAnyOf", "t")).toBe(false);
    expect(c("odrl:isAnyOf", ["t"])).toBe(true);
    expect(c("odrl:eq", ["t"])).toBe(false);
  });
  test("a scope outside Process, Task, Role, purpose, dateTime and elapsedTime is refused", () => {
    const scoped = (leftOperand: string, rightOperand: string) =>
      bad({ permission: [{ assignee: "a", action: "b", constraint: [{ leftOperand, operator: "odrl:eq", rightOperand }] }] });
    for (const outside of ["odrl:spatial", "odrl:count", "odrl:recipient", "odrl:industry", "odrl:event", "cat-harness:folio", "process"]) {
      expect({ outside, parses: scoped(outside, "x") }).toEqual({ outside, parses: false });
    }
    // The six inside the list are accepted, prefixed and (ODRL's) unprefixed.
    const inside: Array<[string, string]> = [
      ["cat-harness:process", "p"],
      ["cat-harness:task", "t"],
      ["cat-harness:role", "r"],
      ["odrl:purpose", "HRESCH"],
      ["purpose", "HRESCH"],
      ["odrl:dateTime", "2026-12-31T00:00:00Z"],
      ["dateTime", "2026-12-31T00:00:00Z"],
      ["odrl:elapsedTime", "P90D"],
      ["elapsedTime", "P90D"],
    ];
    for (const [operand, value] of inside) {
      expect({ operand, parses: scoped(operand, value) }).toEqual({ operand, parses: true });
    }
  });
  test("a purpose constraint accepts HL7 PurposeOfUse codes and refuses draft vocabularies (DPV)", () => {
    expect(
      bad({
        permission: [
          {
            assignee: "a",
            action: "b",
            constraint: [{ leftOperand: "odrl:purpose", operator: "odrl:isA", rightOperand: "HRESCH" }],
          },
        ],
      }),
    ).toBe(true);
    expect(
      bad({
        permission: [
          {
            assignee: "a",
            action: "b",
            constraint: [{ leftOperand: "odrl:purpose", operator: "odrl:isA", rightOperand: "dpv:ResearchAndDevelopment" }],
          },
        ],
      }),
    ).toBe(false);
  });
  test("a duty accepts only the supported ODRL duty actions (delete, attribute, inform, obtainConsent)", () => {
    for (const action of ["odrl:delete", "odrl:attribute", "odrl:inform", "odrl:obtainConsent"]) {
      expect(bad({ permission: [{ assignee: "a", action: "b", duty: [{ action }] }] })).toBe(true);
    }
    // ODRL's bare JSON-LD spellings of the same four are accepted too.
    for (const action of ["delete", "attribute", "inform", "obtainConsent"]) {
      expect(bad({ permission: [{ assignee: "a", action: "b", duty: [{ action }] }] })).toBe(true);
    }
    // Every other action, ODRL duty actions included, is refused.
    for (const action of ["odrl:compensate", "compensate", "odrl:anonymize", "odrl:archive", "odrl:nextPolicy", "odrl:use", "odrl:read", "b", ""]) {
      expect({ action, parses: bad({ permission: [{ assignee: "a", action: "b", duty: [{ action }] }] }) }).toEqual({
        action,
        parses: false,
      });
    }
  });
});

describe("computable DSA constraints and duties (bean s4v2)", () => {
  const g = actionGraph([{ id: "read-dataset", includedIn: ["odrl:use"] }]);

  test("purpose isA HL7 PurposeOfUse HRESCH permits a subclass purpose and denies an unrelated one", () => {
    const dsa = policy({
      "@type": "Agreement",
      assigner: "org:who",
      assignee: "org:ministry",
      permission: [
        {
          assignee: "org:ministry",
          action: "odrl:use",
          constraint: [{ leftOperand: "odrl:purpose", operator: "odrl:isA", rightOperand: "HRESCH" }],
        },
      ],
    });
    const ask = (purpose?: string) =>
      permits(
        {
          actor: "org:ministry",
          action: "read-dataset",
          scope: purpose ? { "odrl:purpose": purpose } : {},
        },
        dsa,
        one(dsa),
        g,
      );
    // HRESCH itself and its subclasses (direct and transitive) are permitted
    expect(ask("HRESCH")).toBe("permit");
    expect(ask("BIORCH")).toBe("permit");
    expect(ask("CLINTRCH")).toBe("permit");
    expect(ask("CLINTRCHPC")).toBe("permit");
    // Unrelated HL7 PurposeOfUse codes are denied
    expect(ask("TREAT")).toBe("deny");
    expect(ask("PUBHLTH")).toBe("deny");
    expect(ask("HMARKT")).toBe("deny");
    // Absent purpose is unknown
    expect(ask()).toBe("unknown");
  });

  test("dateTime lt permits before and denies after (and lteq/gt/gteq evaluate boundaries)", () => {
    const dsaWith = (operator: OdrlOperator) => policy({
      "@type": "Agreement",
      assigner: "org:who",
      assignee: "org:ministry",
      permission: [
        {
          assignee: "org:ministry",
          action: "odrl:use",
          constraint: [{ leftOperand: "odrl:dateTime", operator, rightOperand: "2026-12-31T00:00:00Z" }],
        },
      ],
    });
    const dsa = dsaWith("odrl:lt");
    const askWith = (operator: OdrlOperator, dateTime: string) => {
      const p = dsaWith(operator);
      return permits({ actor: "org:ministry", action: "read-dataset", scope: { "odrl:dateTime": dateTime } }, p, one(p), g);
    };
    const ask = (dateTime?: string) =>
      permits(
        {
          actor: "org:ministry",
          action: "read-dataset",
          scope: dateTime ? { "odrl:dateTime": dateTime } : {},
        },
        dsa,
        one(dsa),
        g,
      );
    expect(ask("2026-06-15T12:00:00Z")).toBe("permit");
    expect(ask("2026-12-31T00:00:00Z")).toBe("deny");
    expect(ask("2027-01-01T00:00:00Z")).toBe("deny");
    expect(ask()).toBe("unknown");

    // Before, AT and after the boundary, for each of the other three.
    const before = "2026-06-15T12:00:00Z";
    const at = "2026-12-31T00:00:00Z";
    const after = "2027-01-01T00:00:00Z";
    const expected: Partial<Record<OdrlOperator, Decision[]>> = {
      "odrl:lteq": ["permit", "permit", "deny"],
      "odrl:gt": ["deny", "deny", "permit"],
      "odrl:gteq": ["deny", "permit", "permit"],
    };
    for (const [operator, want] of Object.entries(expected) as Array<[OdrlOperator, Decision[]]>) {
      expect({ operator, got: [before, at, after].map((d) => askWith(operator, d)) }).toEqual({ operator, got: want });
    }
  });

  test("a 90-day delete duty: permit inside 90 days; after, deny without a deletion PROV record, permit with one, unknown when records are absent", () => {
    const dsa = policy({
      "@type": "Agreement",
      uid: "urn:dsa:90d",
      assigner: "org:who",
      assignee: "org:ministry",
      permission: [
        {
          assignee: "org:ministry",
          action: "odrl:use",
          target: "dataset: cholera-2026",
          duty: [
            {
              action: "odrl:delete",
              constraint: [{ leftOperand: "odrl:elapsedTime", operator: "odrl:lteq", rightOperand: "P90D" }],
            },
          ],
        },
      ],
    });

    const deletionProv = ProvActivitySchema.parse({
      "@type": "prov:Activity",
      "@id": "urn:run:delete-1",
      "prov:startedAtTime": "2026-11-15T10:00:00Z",
      "prov:qualifiedAssociation": {
        "prov:agent": "org:ministry",
        "prov:hadRole": "data-custodian",
        "prov:hadPlan": "dsa-lifecycle#Task_delete",
      },
      "prov:used": ["dataset: cholera-2026"],
      "cat-harness:underPolicy": "urn:dsa:90d",
    });

    const otherProv = ProvActivitySchema.parse({
      "@type": "prov:Activity",
      "@id": "urn:run:other-1",
      "prov:startedAtTime": "2026-10-01T10:00:00Z",
      "prov:qualifiedAssociation": {
        "prov:agent": "org:ministry",
        "prov:hadRole": "data-custodian",
        "prov:hadPlan": "dsa-lifecycle#Task_analyze",
      },
      "prov:used": ["dataset: cholera-2026"],
      "cat-harness:underPolicy": "urn:dsa:90d",
    });

    const ask = (elapsedTime: string, provRecords?: (typeof deletionProv)[]) =>
      permits(
        {
          actor: "org:ministry",
          action: "read-dataset",
          scope: { target: "dataset: cholera-2026", "odrl:elapsedTime": elapsedTime },
          provRecords,
        },
        dsa,
        one(dsa),
        g,
      );

    // Inside 90 days -> permit (even with no deletion PROV record yet)
    expect(ask("P30D")).toBe("permit");
    expect(ask("P90D", [])).toBe("permit");

    // After 90 days -> deny without a deletion PROV record
    expect(ask("P91D", [])).toBe("deny");
    expect(ask("P100D", [otherProv])).toBe("deny");

    // After 90 days -> permit with a deletion PROV record
    expect(ask("P91D", [deletionProv])).toBe("permit");
    expect(ask("P120D", [otherProv, deletionProv])).toBe("permit");

    // After 90 days -> unknown when PROV records are absent
    expect(ask("P91D", undefined)).toBe("unknown");
  });

  test("immediate duties (attribute, inform, obtainConsent): permit when fulfilled, deny when unmet, unknown when records are absent", () => {
    const dsa = policy({
      "@type": "Agreement",
      uid: "urn:dsa:attr",
      assigner: "org:who",
      assignee: "org:ministry",
      permission: [
        {
          assignee: "org:ministry",
          action: "odrl:use",
          duty: [{ action: "odrl:attribute" }, { action: "odrl:inform" }],
        },
      ],
    });
    const attrProv = ProvActivitySchema.parse({
      "@type": "prov:Activity",
      "@id": "urn:run:attr",
      "prov:startedAtTime": "2026-10-01T10:00:00Z",
      "prov:qualifiedAssociation": {
        "prov:agent": "org:ministry",
        "prov:hadRole": "recipient",
        "prov:hadPlan": "dsa-lifecycle#Task_attribute",
      },
      "cat-harness:underPolicy": "urn:dsa:attr",
    });
    const informProv = ProvActivitySchema.parse({
      "@type": "prov:Activity",
      "@id": "urn:run:inform",
      "prov:startedAtTime": "2026-10-01T10:05:00Z",
      "prov:qualifiedAssociation": {
        "prov:agent": "org:ministry",
        "prov:hadRole": "recipient",
        "prov:hadPlan": "dsa-lifecycle#Task_inform",
      },
      "cat-harness:underPolicy": "urn:dsa:attr",
    });

    expect(permits({ actor: "org:ministry", action: "read-dataset" }, dsa, one(dsa), g)).toBe("unknown");
    expect(permits({ actor: "org:ministry", action: "read-dataset", provRecords: [attrProv] }, dsa, one(dsa), g)).toBe("deny");
    expect(
      permits({ actor: "org:ministry", action: "read-dataset", provRecords: [attrProv, informProv] }, dsa, one(dsa), g),
    ).toBe("permit");

    // obtainConsent, the third immediate duty. Fulfilled by a PROV record of
    // the obtainConsent task; unmet when the consent verdict is deny; unknown
    // with no record and no verdict. (A record set that lacks the task also
    // reads as unknown, never deny: bean a7c1 lets only a consent verdict deny.)
    const consentDsa = policy({
      "@type": "Agreement",
      uid: "urn:dsa:consent",
      assigner: "org:who",
      assignee: "org:ministry",
      permission: [{ assignee: "org:ministry", action: "odrl:use", duty: [{ action: "odrl:obtainConsent" }] }],
    });
    const consentProv = ProvActivitySchema.parse({
      "@type": "prov:Activity",
      "@id": "urn:run:consent",
      "prov:startedAtTime": "2026-10-01T10:10:00Z",
      "prov:qualifiedAssociation": {
        "prov:agent": "org:ministry",
        "prov:hadRole": "recipient",
        "prov:hadPlan": "dsa-lifecycle#Task_obtainConsent",
      },
      "cat-harness:underPolicy": "urn:dsa:consent",
    });
    const askConsent = (extra: Record<string, unknown>) =>
      permits({ actor: "org:ministry", action: "read-dataset", ...extra }, consentDsa, one(consentDsa), g);
    expect(askConsent({})).toBe("unknown");
    expect(askConsent({ provRecords: [consentProv] })).toBe("permit");
    expect(askConsent({ consentVerdict: "deny" })).toBe("deny");
    expect(askConsent({ provRecords: [attrProv] })).toBe("unknown");
  });
});

describe("odrl:obtainConsent duty evaluated via injected ConsentEvaluator (beans a7c1, 2egb, 6jnx)", () => {
  const g = actionGraph([{ id: "read-dataset", includedIn: ["odrl:use"] }]);
  const purposeGraph = new Map<string, readonly string[]>(Object.entries(HL7_PURPOSE_OF_USE));

  const dsaWithConsentDuty = policy({
    "@type": "Agreement",
    uid: "urn:dsa:pcf6",
    assigner: "org:who",
    assignee: "org:ministry",
    permission: [
      {
        assignee: "org:ministry",
        action: "odrl:use",
        target: "subject:pat-1",
        constraint: [{ leftOperand: "odrl:purpose", operator: "odrl:isA", rightOperand: "PurposeOfUse" }],
        duty: [{ action: "odrl:obtainConsent" }],
      },
    ],
  });

  // Injected evaluator simulating an active permit consent for TREAT on subject:pat-1 in 2026
  const activePermitEvaluator: ConsentEvaluator = (req) => {
    const scope = req.scope ?? {};
    if (req.actor !== "org:ministry" || scope.target !== "subject:pat-1") {
      return { verdict: "unknown" };
    }
    const dt = scope["odrl:dateTime"] ?? scope.dateTime;
    if (!dt || dt < "2026-01-01" || dt > "2026-12-31T23:59:59.999Z") {
      return {
        verdict: "deny",
        consent: { id: "c-permit", versionId: "1", uid: "urn:consent:c-permit:v1" },
      };
    }
    const purpose = scope["odrl:purpose"] ?? scope.purpose;
    if (!purpose) return { verdict: "unknown" };
    if (!broaderOrSelf(purpose, purposeGraph).has("TREAT")) {
      return {
        verdict: "deny",
        consent: { id: "c-permit", versionId: "1", uid: "urn:consent:c-permit:v1" },
      };
    }
    return {
      verdict: "permit",
      consent: { id: "c-permit", versionId: "1", uid: "urn:consent:c-permit:v1" },
    };
  };

  const activeDenyEvaluator: ConsentEvaluator = () => ({
    verdict: "deny",
    consent: { id: "c-dissent", versionId: "2", uid: "urn:consent:c-dissent:v2" },
  });

  const inactiveOrAbsentEvaluator: ConsentEvaluator = () => ({
    verdict: "unknown",
  });

  test("DSA + no consent (or inactive/draft consent returning unknown) gives unknown, never permit or deny", () => {
    const baseReq = {
      actor: "org:ministry",
      action: "read-dataset",
      scope: {
        target: "subject:pat-1",
        "odrl:purpose": "TREAT",
        "odrl:dateTime": "2026-06-15T12:00:00Z",
      },
    };

    // No evaluator or verdict supplied at all -> unknown
    expect(permits(baseReq, dsaWithConsentDuty, one(dsaWithConsentDuty), g)).toBe("unknown");
    expect(decide(baseReq, one(dsaWithConsentDuty), g)).toBe("unknown");

    // Injected evaluator returning unknown (e.g. no active consent or draft/inactive status) -> unknown
    expect(
      permits(
        { ...baseReq, consentEvaluator: inactiveOrAbsentEvaluator },
        dsaWithConsentDuty,
        one(dsaWithConsentDuty),
        g,
      ),
    ).toBe("unknown");
    expect(
      decide(
        { ...baseReq, consentEvaluator: inactiveOrAbsentEvaluator },
        one(dsaWithConsentDuty),
        g,
      ),
    ).toBe("unknown");

    // Pre-computed verdict unknown -> unknown
    expect(
      permits({ ...baseReq, consentVerdict: "unknown" }, dsaWithConsentDuty, one(dsaWithConsentDuty), g),
    ).toBe("unknown");
  });

  test("DSA + deny consent gives deny and surfaces the deciding citation", () => {
    const baseScope = {
      target: "subject:pat-1",
      "odrl:purpose": "TREAT",
      "odrl:dateTime": "2026-06-15T12:00:00Z",
    };

    // 1. Explicit deny from injected consent evaluator -> deny + citation
    const denyRes = permitsWithConsent(
      {
        actor: "org:ministry",
        action: "read-dataset",
        scope: baseScope,
        consentEvaluator: activeDenyEvaluator,
      },
      dsaWithConsentDuty,
      one(dsaWithConsentDuty),
      g,
    );
    expect(denyRes.decision).toBe("deny");
    expect(denyRes.consent).toEqual({
      id: "c-dissent",
      versionId: "2",
      uid: "urn:consent:c-dissent:v2",
    });
    expect(
      decideWithConsent(
        {
          actor: "org:ministry",
          action: "read-dataset",
          scope: baseScope,
          consentEvaluator: activeDenyEvaluator,
        },
        one(dsaWithConsentDuty),
        g,
      ),
    ).toEqual({
      decision: "deny",
      consent: { id: "c-dissent", versionId: "2", uid: "urn:consent:c-dissent:v2" },
    });

    // 2. Active permit consent for TREAT, but request asks for HMARKT -> deny
    expect(
      permits(
        {
          actor: "org:ministry",
          action: "read-dataset",
          scope: { ...baseScope, "odrl:purpose": "HMARKT" },
          consentEvaluator: activePermitEvaluator,
        },
        dsaWithConsentDuty,
        one(dsaWithConsentDuty),
        g,
      ),
    ).toBe("deny");

    // 3. Active permit consent expired at request dateTime -> deny
    expect(
      permits(
        {
          actor: "org:ministry",
          action: "read-dataset",
          scope: { ...baseScope, "odrl:dateTime": "2027-02-01T00:00:00Z" },
          consentEvaluator: activePermitEvaluator,
        },
        dsaWithConsentDuty,
        one(dsaWithConsentDuty),
        g,
      ),
    ).toBe("deny");
  });

  test("DSA + matching active permit consent gives permit (for exact and subclass HL7 PurposeOfUse) and surfaces citation", () => {
    const reqForPurpose = (purpose: string) => ({
      actor: "org:ministry",
      action: "read-dataset",
      scope: {
        target: "subject:pat-1",
        "odrl:purpose": purpose,
        "odrl:dateTime": "2026-06-15T12:00:00Z",
      },
      consentEvaluator: activePermitEvaluator,
    });

    for (const purpose of ["TREAT", "ETREAT", "BTG", "CLINTRL", "POPHLTH", "COC"]) {
      const res = permitsWithConsent(reqForPurpose(purpose), dsaWithConsentDuty, one(dsaWithConsentDuty), g);
      expect(res.decision).toBe("permit");
      expect(res.consent).toEqual({
        id: "c-permit",
        versionId: "1",
        uid: "urn:consent:c-permit:v1",
      });
    }

    expect(decideWithConsent(reqForPurpose("TREAT"), one(dsaWithConsentDuty), g)).toEqual({
      decision: "permit",
      consent: { id: "c-permit", versionId: "1", uid: "urn:consent:c-permit:v1" },
    });
  });

  test("schemas/content/odrl.ts names no FHIR resource and no pcf: key, and reads HL7 PurposeOfUse from published v3-ActReason", () => {
    const odrlSrc = readFileSync(join(import.meta.dir, "odrl.ts"), "utf-8");
    expect(odrlSrc).not.toContain("pcf:");
    expect(odrlSrc).not.toContain("FhirConsent");
    expect(odrlSrc).not.toContain("PcfConsent");
    expect(odrlSrc).not.toMatch(/\b(?:Bundle|OperationOutcome|Patient|Practitioner|Encounter)\b/);

    const fixtureDir = resolve(import.meta.dir, "../..", "test", "fixtures", HL7_TERMINOLOGY_PACKAGE_ID);
    const prov = JSON.parse(readFileSync(join(fixtureDir, "provenance.json"), "utf-8"));
    const csBytes = readFileSync(join(fixtureDir, "CodeSystem-v3-ActReason.json"));
    const sha = createHash("sha256").update(csBytes).digest("hex");
    expect(sha).toBe(prov.packages[HL7_TERMINOLOGY_PACKAGE_ID].files["CodeSystem-v3-ActReason.json"].sha256);
    // odrl.ts's table IS what its loader reads from that published file — not
    // a hand-typed copy that happens to agree on the codes spot-checked below.
    expect(HL7_PURPOSE_OF_USE).toEqual(loadHl7PurposeOfUseFromActReason(join(fixtureDir, "CodeSystem-v3-ActReason.json")));
    expect(odrlSrc).toContain("HL7_PURPOSE_OF_USE: Readonly<Record<string, readonly string[]>> = loadHl7PurposeOfUseFromActReason()");

    // Verified from published hl7.terminology.r4#5.3.0 CodeSystem-v3-ActReason.json:
    // CLINTRL, POPHLTH, and COC are subsumedBy TREAT; CAREMGT is subsumedBy HOPERAT only (not TREAT);
    // HTEST is subsumedBy SYSDEV (-> HOPERAT); LABELING and METAMGT are subsumedBy HSYSADMIN (-> HOPERAT);
    // HAAUTH does not exist in v3-ActReason.
    expect(HL7_PURPOSE_OF_USE.CLINTRL).toEqual(["TREAT"]);
    expect(HL7_PURPOSE_OF_USE.POPHLTH).toEqual(["TREAT"]);
    expect(HL7_PURPOSE_OF_USE.COC).toEqual(["TREAT"]);
    expect(HL7_PURPOSE_OF_USE.CAREMGT).toEqual(["HOPERAT"]);
    expect(HL7_PURPOSE_OF_USE.HTEST).toEqual(["SYSDEV"]);
    expect(HL7_PURPOSE_OF_USE.LABELING).toEqual(["HSYSADMIN"]);
    expect(HL7_PURPOSE_OF_USE.METAMGT).toEqual(["HSYSADMIN"]);
    expect("HAAUTH" in HL7_PURPOSE_OF_USE).toBe(false);
    expect(Object.keys(HL7_PURPOSE_OF_USE).length).toBe(60);
  });
});

describe("PROV-O activity", () => {
  const run = {
    "@type": "prov:Activity",
    "@id": "urn:run:1",
    "prov:startedAtTime": "2026-09-23T19:36:08Z",
    "prov:qualifiedAssociation": {
      "prov:agent": "authoring-agent",
      "prov:hadRole": "author",
      "prov:hadPlan": "content-lifecycle#Task_author",
    },
    "cat-harness:underPolicy": "https://litlfred.github.io/folio-assistant/policies/folio-defaults",
  };
  test("a task run parses", () => {
    expect(ProvActivitySchema.safeParse(run).success).toBe(true);
  });
  test("hadPlan must name a BPMN process and task", () => {
    const r = { ...run, "prov:qualifiedAssociation": { ...run["prov:qualifiedAssociation"], "prov:hadPlan": "author" } };
    expect(ProvActivitySchema.safeParse(r).success).toBe(false);
  });
  test("a run under no policy cannot be checked, so it is refused", () => {
    const { "cat-harness:underPolicy": _drop, ...r } = run;
    expect(ProvActivitySchema.safeParse(r).success).toBe(false);
  });
  test("several policies in force are listed, and an empty list is still no policy", () => {
    expect(ProvActivitySchema.safeParse({ ...run, "cat-harness:underPolicy": ["urn:a", "urn:b"] }).success).toBe(true);
    expect(ProvActivitySchema.safeParse({ ...run, "cat-harness:underPolicy": [] }).success).toBe(false);
  });
  test("it cannot end before it starts", () => {
    expect(ProvActivitySchema.safeParse({ ...run, "prov:endedAtTime": "2026-09-23T19:00:00Z" }).success).toBe(false);
  });
});
