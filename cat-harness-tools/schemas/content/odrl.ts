/**
 * W3C ODRL 2.2 policies: what an Actor may do, scoped by Process, Task and Role.
 *
 * Policies are their own **graph typology**; an unauthenticated reader may
 * **visualize and render only**. The design is
 * `docs/proposals/odrl-prov-actor-model.md`.
 *
 * ## The subset
 *
 * A Policy (`Set`, `Offer`, `Agreement`) holding `permission` and
 * `prohibition` rules (plus optional `duty` obligations), each naming an
 * `assignee`, an `action`, an optional `target`, optional `constraint`s and
 * optional `duty` rules. Refinements and party collections have no reader
 * yet, so they are not accepted. A key outside the subset is refused rather
 * than dropped (`.strict()`): a permission rule must never silently mean less
 * than it says.
 *
 * Terms are written as compact IRIs, as ODRL's own JSON-LD context writes
 * them: `odrl:display`, `cat-harness:perform-task`, and a bare action id for one
 * the folio profile declares (`content-authoring`).
 *
 * ## Actions inherit through `includedIn`
 *
 * The folio profile is `skills/permissions/permissions.json`: every action
 * says which broader actions it is `includedIn`, ending at ODRL's own common
 * vocabulary. A permission to a broader action permits every action included
 * in it. The graph is walked with a visited set, so it need not be a tree or
 * acyclic, and a cycle cannot hang a decision.
 *
 * @module schemas/odrl
 * @graphNode schema
 *
 * @conformsTo w3c-odrl
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * The ODRL 2.2 namespace. A policy here binds it as `@vocab` in an inline
 * context instead of referencing W3C's published `odrl.jsonld`, so the
 * document can be read with no network and every term still expands to the
 * IRI that context gives it.
 */
export const ODRL_NS = "http://www.w3.org/ns/odrl/2/" as const;

/**
 * The ODRL common-vocabulary actions the folio profile hangs off, with ODRL's
 * own `includedIn` for each. Only the ones used are listed; `odrl:use` is the
 * top of this part of ODRL's action graph.
 */
export const ODRL_ACTIONS: Readonly<Record<string, readonly string[]>> = {
  "odrl:use": [],
  "odrl:display": ["odrl:use"],
  "odrl:derive": ["odrl:use"],
  "odrl:annotate": ["odrl:use"],
  "odrl:modify": ["odrl:use"],
  "odrl:translate": ["odrl:use"],
  "odrl:execute": ["odrl:use"],
  "odrl:delete": ["odrl:use"],
  "odrl:attribute": ["odrl:use"],
  "odrl:inform": ["odrl:use"],
  "odrl:obtainConsent": ["odrl:use"],
};

/**
 * The ODRL 2.2 duty actions supported for computable data sharing agreements
 * (bean `s4v2`, issue #2702). Both `odrl:`-prefixed and bare ODRL JSON-LD
 * spellings are accepted and normalized to `odrl:<action>`.
 */
export const ODRL_DUTY_ACTIONS = [
  "odrl:delete",
  "odrl:attribute",
  "odrl:inform",
  "odrl:obtainConsent",
  "delete",
  "attribute",
  "inform",
  "obtainConsent",
] as const;
export type OdrlDutyAction = (typeof ODRL_DUTY_ACTIONS)[number];

/**
 * HL7 v3 `ActReason` terminology (`PurposeOfUse` hierarchy), read from the
 * pinned `hl7.terminology.r4#5.3.0` package (`CodeSystem-v3-ActReason.json`)
 * rather than hand-typed (bean `6jnx`, `s4v2`).
 *
 * Owner rule, 2026-10-30 14:00Z (bean `s4v2`): no draft standards unless
 * approved. W3C DPV is a Community Group report and is NOT used; `purpose`
 * constraints use HL7 `PurposeOfUse` codes, with `isA` walking this hierarchy
 * via {@link broaderOrSelf}.
 */
export const HL7_ACT_REASON_SYSTEM = "http://terminology.hl7.org/CodeSystem/v3-ActReason" as const;
export const HL7_TERMINOLOGY_PACKAGE_ID = "hl7.terminology.r4#5.3.0" as const;

interface ActReasonConceptProperty {
  code?: string;
  valueCode?: string;
}

interface ActReasonConceptNode {
  code?: string;
  property?: readonly ActReasonConceptProperty[];
  concept?: readonly ActReasonConceptNode[];
}

function resolveActReasonDefinitionPath(): string {
  const filename = "CodeSystem-v3-ActReason.json";
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // input-site: inert #04348fc5 — fallback to the local FHIR package cache when the committed test fixture is absent
    join(homedir(), ".fhir", "packages", HL7_TERMINOLOGY_PACKAGE_ID, "package", filename),
    resolve(here, "..", "..", "test", "fixtures", HL7_TERMINOLOGY_PACKAGE_ID, filename),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Cannot locate ${filename} from ${HL7_TERMINOLOGY_PACKAGE_ID} (checked ${candidates.join(", ")})`,
  );
}

/**
 * Load the `PurposeOfUse` `subsumedBy` hierarchy directly from the published
 * `hl7.terminology.r4#5.3.0` `v3-ActReason` definition.
 */
export function loadHl7PurposeOfUseFromActReason(
  path: string = resolveActReasonDefinitionPath(),
): Readonly<Record<string, readonly string[]>> {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as {
    concept?: readonly ActReasonConceptNode[];
  };
  const rawParents = new Map<string, string[]>();

  const walk = (nodes: readonly ActReasonConceptNode[] | undefined, structuralParent?: string): void => {
    for (const node of nodes ?? []) {
      const code = node.code;
      if (!code) continue;
      const parents = rawParents.get(code) ?? [];
      if (structuralParent && !parents.includes(structuralParent)) {
        parents.push(structuralParent);
      }
      for (const prop of node.property ?? []) {
        if (prop.code === "subsumedBy" && typeof prop.valueCode === "string" && !parents.includes(prop.valueCode)) {
          parents.push(prop.valueCode);
        }
      }
      rawParents.set(code, parents);
      walk(node.concept, code);
    }
  };
  walk(raw.concept);

  const inPurposeOfUse = new Map<string, boolean>();
  const reachesPurposeOfUse = (code: string, visiting = new Set<string>()): boolean => {
    if (code === "PurposeOfUse") return true;
    const cached = inPurposeOfUse.get(code);
    if (cached !== undefined) return cached;
    if (visiting.has(code)) return false;
    visiting.add(code);
    const parents = rawParents.get(code) ?? [];
    const reaches = parents.some((p) => reachesPurposeOfUse(p, new Set(visiting)));
    inPurposeOfUse.set(code, reaches);
    return reaches;
  };

  const out: Record<string, readonly string[]> = {
    PurposeOfUse: [],
  };
  for (const [code, parents] of rawParents.entries()) {
    if (code === "PurposeOfUse") continue;
    if (reachesPurposeOfUse(code)) {
      out[code] = Object.freeze(parents.filter((p) => p === "PurposeOfUse" || reachesPurposeOfUse(p)));
    }
  }
  return Object.freeze(out);
}

export const HL7_PURPOSE_OF_USE: Readonly<Record<string, readonly string[]>> = loadHl7PurposeOfUseFromActReason();

const PURPOSE_GRAPH: ReadonlyMap<string, readonly string[]> = new Map(Object.entries(HL7_PURPOSE_OF_USE));

/** Normalize an HL7 PurposeOfUse code (stripping optional system IRI or prefix). */
export function normalizePurposeCode(code: string): string {
  if (code.startsWith(`${HL7_ACT_REASON_SYSTEM}#`) || code.startsWith(`${HL7_ACT_REASON_SYSTEM}/`)) {
    return code.slice(HL7_ACT_REASON_SYSTEM.length + 1);
  }
  if (code.startsWith("v3-ActReason:") || code.startsWith("hl7:")) {
    return code.slice(code.indexOf(":") + 1);
  }
  return code;
}

/** Whether `code` is a known HL7 `PurposeOfUse` code (never a draft vocabulary such as `dpv:*`). */
export function isValidPurposeOfUse(code: string): boolean {
  if (code.startsWith("dpv:") || code.includes("/dpv")) return false;
  return PURPOSE_GRAPH.has(normalizePurposeCode(code));
}

/**
 * The folio profile's `leftOperand`s: BPMN scope (`cat-harness:process`,
 * `cat-harness:task`, `cat-harness:role`) and ODRL 2.2 DSA constraints
 * (`odrl:purpose`, `odrl:dateTime`, `odrl:elapsedTime` and their unprefixed
 * JSON-LD forms). Absent scope on a rule means everywhere.
 */
export const FOLIO_LEFT_OPERANDS = [
  "cat-harness:process",
  "cat-harness:task",
  "cat-harness:role",
  "odrl:purpose",
  "odrl:dateTime",
  "odrl:elapsedTime",
  "purpose",
  "dateTime",
  "elapsedTime",
] as const;
export type FolioLeftOperand = (typeof FOLIO_LEFT_OPERANDS)[number];

/** The operators this subset evaluates: ODRL's `eq`, `neq`, `isAnyOf`, `isNoneOf`, `lt`, `lteq`, `gt`, `gteq`, `isA`. */
export const ODRL_OPERATORS = [
  "odrl:eq",
  "odrl:neq",
  "odrl:isAnyOf",
  "odrl:isNoneOf",
  "odrl:lt",
  "odrl:lteq",
  "odrl:gt",
  "odrl:gteq",
  "odrl:isA",
  "eq",
  "neq",
  "isAnyOf",
  "isNoneOf",
  "lt",
  "lteq",
  "gt",
  "gteq",
  "isA",
] as const;
export type OdrlOperator = (typeof ODRL_OPERATORS)[number];

/** Anyone, authenticated or not. Owner: such a reader may visualize and render, and nothing else. */
export const ANYONE = "cat-harness:anyone" as const;

/**
 * ODRL's conflict strategies. The folio profile's default when a policy names
 * none is `odrl:prohibit`: the safe reading, stated here as OUR rule rather
 * than claimed as ODRL's.
 *
 * ODRL 2.2 §2.10 says otherwise — "If the conflict property is not explicitly
 * set, the default of invalid will be used" — so this is a PROFILE DEPARTURE,
 * kept by owner ruling on 2026-10-01 (bean `jcet`): an unstated clash denies
 * rather than voiding the whole policy. Changing it is a policy decision, not
 * a conformance fix; `odrl.test.ts` pins the value.
 */
export const ODRL_CONFLICT = ["odrl:perm", "odrl:prohibit", "odrl:invalid"] as const;
export const FOLIO_DEFAULT_CONFLICT = "odrl:prohibit" as const;

const SET_OPERATORS = new Set<string>(["odrl:isAnyOf", "odrl:isNoneOf", "isAnyOf", "isNoneOf"]);
const isPurposeLeftOperand = (op: string): boolean => op === "odrl:purpose" || op === "purpose";

export const OdrlConstraintSchema = z
  .object({
    leftOperand: z.enum(FOLIO_LEFT_OPERANDS),
    operator: z.enum(ODRL_OPERATORS),
    rightOperand: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  })
  .strict()
  .refine(
    (c) => SET_OPERATORS.has(c.operator) === Array.isArray(c.rightOperand),
    { message: "isAnyOf/isNoneOf take a list; eq/neq/lt/lteq/gt/gteq/isA take one value" },
  )
  .refine(
    (c) =>
      !isPurposeLeftOperand(c.leftOperand) ||
      (Array.isArray(c.rightOperand) ? c.rightOperand : [c.rightOperand]).every(isValidPurposeOfUse),
    {
      message:
        "purpose rightOperand must be an HL7 PurposeOfUse code (http://terminology.hl7.org/CodeSystem/v3-ActReason); draft standards such as W3C DPV are not accepted",
      path: ["rightOperand"],
    },
  );

export type OdrlConstraint = z.infer<typeof OdrlConstraintSchema>;

export const OdrlDutySchema = z
  .object({
    uid: z.string().min(1).optional(),
    action: z.enum(ODRL_DUTY_ACTIONS),
    target: z.string().min(1).optional(),
    assigner: z.string().min(1).optional(),
    assignee: z.string().min(1).optional(),
    constraint: z.array(OdrlConstraintSchema).optional(),
  })
  .strict();

export type OdrlDuty = z.infer<typeof OdrlDutySchema>;

export const OdrlRuleSchema = z
  .object({
    /** An actor id, a party IRI/DID, or {@link ANYONE}. */
    assignee: z.string().min(1),
    action: z.string().min(1),
    /** What the rule applies to; absent means the layer's whole graph. */
    target: z.string().min(1).optional(),
    constraint: z.array(OdrlConstraintSchema).optional(),
    /** Duties attached to a Permission rule (ODRL 2.2 §2.6.5). */
    duty: z.array(OdrlDutySchema).min(1).optional(),
  })
  .strict();

export const OdrlPolicySchema = z
  .object({
    "@context": z.union([z.string(), z.array(z.unknown()), z.record(z.string(), z.unknown())]),
    "@type": z.enum(["Set", "Offer", "Agreement"]),
    uid: z.string().min(1),
    /** The folio ODRL profile; required, because the actions only mean something against it. */
    profile: z.string().min(1),
    /** Policies whose rules this one inherits: ODRL's `inheritFrom`. */
    inheritFrom: z.array(z.string().min(1)).optional(),
    conflict: z.enum(ODRL_CONFLICT).optional(),
    /** An Agreement names who grants it (ODRL 2.2 §2.1.3). A Set does not have to. */
    assigner: z.string().min(1).optional(),
    /** An Agreement names who receives it (ODRL 2.2 §2.1.3). A Set does not have to. */
    assignee: z.string().min(1).optional(),
    permission: z.array(OdrlRuleSchema).default([]),
    prohibition: z.array(OdrlRuleSchema).default([]),
    /** Policy-level duties (ODRL 2.2 §2.6.4). */
    obligation: z.array(OdrlDutySchema).min(1).optional(),
  })
  .strict()
  .refine((p) => p["@type"] !== "Agreement" || !!p.assigner, {
    message: "an odrl:Agreement names its assigner",
    path: ["assigner"],
  })
  .refine((p) => p["@type"] !== "Agreement" || !!p.assignee, {
    message: "an odrl:Agreement names its assignee",
    path: ["assignee"],
  });

export type OdrlPolicy = z.infer<typeof OdrlPolicySchema>;
export type OdrlRule = z.infer<typeof OdrlRuleSchema>;

/** Where a layer keeps its policies: the `policies` graph typology's directory. */
export const POLICY_DIR = "policies";

/**
 * Every policy in a directory, keyed by `uid`. Absent directory → none. A file
 * that is not a valid policy THROWS, on the rule every declaration here
 * follows: a permission file nobody can read would leave everyone with
 * nothing, silently.
 */
export function readPolicies(dir: string): Map<string, OdrlPolicy> {
  const out = new Map<string, OdrlPolicy>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".jsonld")).sort()) {
    const p = join(dir, f);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(p, "utf-8"));
    } catch (e) {
      throw new Error(`${p} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (raw && typeof raw === "object") delete (raw as Record<string, unknown>)._comment;
    const parsed = OdrlPolicySchema.safeParse(raw);
    if (!parsed.success) throw new Error(`${p} is not a valid ODRL policy: ${parsed.error.message}`);
    if (out.has(parsed.data.uid)) throw new Error(`${p}: policy uid "${parsed.data.uid}" is declared twice.`);
    out.set(parsed.data.uid, parsed.data);
  }
  return out;
}

/**
 * A policy's rules with everything it inherits, depth-first, each policy once.
 * An `inheritFrom` that names no known policy throws: an inherited grant that
 * silently vanished would be a permission change nobody made.
 */
export function effectiveRules(
  policy: OdrlPolicy,
  all: ReadonlyMap<string, OdrlPolicy>,
): { permission: OdrlRule[]; prohibition: OdrlRule[] } {
  const permission: OdrlRule[] = [];
  const prohibition: OdrlRule[] = [];
  const seen = new Set<string>();
  const visit = (p: OdrlPolicy) => {
    if (seen.has(p.uid)) return;
    seen.add(p.uid);
    permission.push(...p.permission);
    prohibition.push(...p.prohibition);
    for (const uid of p.inheritFrom ?? []) {
      const parent = all.get(uid);
      if (!parent) throw new Error(`policy ${p.uid} inherits from ${uid}, which is not declared`);
      visit(parent);
    }
  };
  visit(policy);
  return { permission, prohibition };
}

/** The action graph: an action id → the actions it is `includedIn`. */
export type ActionGraph = ReadonlyMap<string, readonly string[]>;

/** The folio profile's actions joined to ODRL's. */
export function actionGraph(profile: readonly { id: string; includedIn: readonly string[] }[]): ActionGraph {
  const g = new Map<string, readonly string[]>(Object.entries(ODRL_ACTIONS));
  for (const a of profile) g.set(a.id, a.includedIn);
  return g;
}

/** `action` and every action it is included in, however reached. Cycle-safe. */
export function broaderOrSelf(action: string, graph: ActionGraph): Set<string> {
  const out = new Set<string>();
  const stack = [action];
  while (stack.length) {
    const a = stack.pop()!;
    if (out.has(a)) continue;
    out.add(a);
    for (const up of graph.get(a) ?? []) stack.push(up);
  }
  return out;
}

/**
 * A PROV-O activity record (compatible with `ProvActivity` in `./prov.ts`)
 * consulted to verify whether an ODRL Duty has been exercised.
 */
export interface ProvDutyRecord {
  "@type"?: "prov:Activity" | string;
  "@id"?: string;
  "prov:startedAtTime"?: string;
  "prov:endedAtTime"?: string;
  "prov:qualifiedAssociation"?: {
    "prov:agent": string;
    "prov:hadRole"?: string;
    "prov:hadPlan"?: string;
  };
  "prov:agent"?: string;
  "prov:actedOnBehalfOf"?: string;
  /** A node reference, or a described entity (e.g. an agreement's DCAT distribution), matched by its `@id`. */
  "prov:used"?: readonly (string | { "@id": string })[];
  "prov:generated"?: readonly string[];
  "prov:invalidated"?: readonly string[];
  "cat-harness:underPolicy"?: string | readonly string[];
  "odrl:action"?: string;
  action?: string;
  target?: string;
}

/**
 * THREE answers, never two. `unknown` means no rule speaks to the request, and
 * it is never permit: a caller that treats it as permit has built an open
 * door, and one that treats it as deny cannot tell "forbidden" from "nobody
 * has decided", which is the question the QA/QC report asks.
 */
export type Decision = "permit" | "deny" | "unknown";

/**
 * Citation identifying the consent record that decided an `odrl:obtainConsent`
 * duty (beans `a7c1`, `2egb`, `6jnx`).
 */
export interface ConsentDecisionRef {
  id: string;
  versionId: string;
  uid?: string;
}

/**
 * Plain consent verdict (`permit` | `deny` | `unknown`) plus optional citation
 * returned by an injected {@link ConsentEvaluator} for an `odrl:obtainConsent`
 * duty (bean `6jnx`).
 */
export interface ConsentEvaluation {
  verdict: Decision;
  consent?: ConsentDecisionRef;
}

/**
 * Injected callback invoked when evaluating an `odrl:obtainConsent` duty on a
 * matching permission rule (beans `a7c1`, `6jnx`). Domain layers above
 * `cat-harness` parse domain consent records and return the plain verdict
 * (`permit` | `deny` | `unknown`) together with the deciding citation.
 */
export type ConsentEvaluator = (
  req: PermitRequest,
  duty: OdrlDuty,
  rule: OdrlRule,
  policy: OdrlPolicy,
) => ConsentEvaluation | Decision;

/** The scope a request is made in. Every field is optional, and an absent one satisfies no constraint on it. */
export interface RequestScope {
  "cat-harness:process"?: string;
  "cat-harness:task"?: string;
  "cat-harness:role"?: string;
  "odrl:purpose"?: string;
  purpose?: string;
  "odrl:dateTime"?: string;
  dateTime?: string;
  "odrl:elapsedTime"?: string | number;
  elapsedTime?: string | number;
  target?: string;
  /** Optional PROV-O records for duty verification when passed inside scope. */
  provRecords?: readonly ProvDutyRecord[];
  /** Optional injected consent evaluator for `odrl:obtainConsent` duties (beans `a7c1`, `6jnx`). */
  consentEvaluator?: ConsentEvaluator;
  /** Optional pre-computed consent verdict for `odrl:obtainConsent` duties (beans `a7c1`, `6jnx`). */
  consentVerdict?: ConsentEvaluation | Decision;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MIN_MS = 60_000;
const SEC_MS = 1_000;

/**
 * Parse an ISO-8601 duration (`P90D`, `PT24H`, `P1Y2M3DT4H5M6S`) or unit
 * shorthand (`90d`, `24h`, numeric ms) into milliseconds.
 */
export function parseDurationMs(value: string | number): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  const s = value.trim();
  const iso =
    /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
      s,
    );
  if (iso && s.length > 1 && s.toUpperCase() !== "PT") {
    const [, y, mo, w, d, h, m, sec] = iso;
    return (
      (y ? Number(y) * 365 * DAY_MS : 0) +
      (mo ? Number(mo) * 30 * DAY_MS : 0) +
      (w ? Number(w) * 7 * DAY_MS : 0) +
      (d ? Number(d) * DAY_MS : 0) +
      (h ? Number(h) * HOUR_MS : 0) +
      (m ? Number(m) * MIN_MS : 0) +
      (sec ? Number(sec) * SEC_MS : 0)
    );
  }
  const unit =
    /^(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)$/i.exec(
      s,
    );
  if (unit) {
    const n = Number(unit[1]!);
    const u = unit[2]!.toLowerCase();
    if (u === "ms") return n;
    if (u.startsWith("s")) return n * SEC_MS;
    if (u.startsWith("m")) return n * MIN_MS;
    if (u.startsWith("h")) return n * HOUR_MS;
    if (u.startsWith("d")) return n * DAY_MS;
    if (u.startsWith("w")) return n * 7 * DAY_MS;
  }
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
  return undefined;
}

function canonicalLeftOperand(op: FolioLeftOperand): string {
  if (op === "purpose" || op === "dateTime" || op === "elapsedTime") return `odrl:${op}`;
  return op;
}

function canonicalOperator(op: OdrlOperator): string {
  return op.startsWith("odrl:") ? op : `odrl:${op}`;
}

function scopeValue(
  leftOperand: FolioLeftOperand,
  scope: RequestScope,
): string | number | readonly string[] | undefined {
  switch (canonicalLeftOperand(leftOperand)) {
    case "odrl:purpose":
      return scope["odrl:purpose"] ?? scope.purpose;
    case "odrl:dateTime":
      return scope["odrl:dateTime"] ?? scope.dateTime;
    case "odrl:elapsedTime":
      return scope["odrl:elapsedTime"] ?? scope.elapsedTime;
    case "cat-harness:process":
      return scope["cat-harness:process"];
    case "cat-harness:task":
      return scope["cat-harness:task"];
    case "cat-harness:role":
      return scope["cat-harness:role"];
    default:
      return undefined;
  }
}

function isBpmnScopeOperand(leftOperand: FolioLeftOperand): boolean {
  const k = canonicalLeftOperand(leftOperand);
  return k === "cat-harness:process" || k === "cat-harness:task" || k === "cat-harness:role";
}

function compareNumbers(lhs: number, rhs: number, op: string): boolean {
  switch (op) {
    case "odrl:eq":
      return lhs === rhs;
    case "odrl:neq":
      return lhs !== rhs;
    case "odrl:lt":
      return lhs < rhs;
    case "odrl:lteq":
      return lhs <= rhs;
    case "odrl:gt":
      return lhs > rhs;
    case "odrl:gteq":
      return lhs >= rhs;
    default:
      return false;
  }
}

function constraintHolds(c: OdrlConstraint, scope: RequestScope): boolean {
  const raw = scopeValue(c.leftOperand, scope);
  // A constraint on something the request does not say is NOT met. Reading
  // "unknown process" as "any process" would widen every scoped grant.
  if (raw === undefined) return false;
  const left = canonicalLeftOperand(c.leftOperand);
  const op = canonicalOperator(c.operator);
  const rhs = c.rightOperand;

  if (left === "odrl:purpose") {
    const v = String(raw);
    if (!isValidPurposeOfUse(v)) return false;
    const normV = normalizePurposeCode(v);
    if (op === "odrl:isA") {
      if (Array.isArray(rhs) || !isValidPurposeOfUse(rhs)) return false;
      return broaderOrSelf(normV, PURPOSE_GRAPH).has(normalizePurposeCode(rhs));
    }
    if (op === "odrl:eq") return !Array.isArray(rhs) && normV === normalizePurposeCode(rhs);
    if (op === "odrl:neq") return !Array.isArray(rhs) && normV !== normalizePurposeCode(rhs);
    if (op === "odrl:isAnyOf") return (rhs as string[]).map(normalizePurposeCode).includes(normV);
    if (op === "odrl:isNoneOf") return !(rhs as string[]).map(normalizePurposeCode).includes(normV);
    return false;
  }

  if (left === "odrl:dateTime") {
    if (Array.isArray(rhs)) {
      const s = String(raw);
      return op === "odrl:isAnyOf" ? rhs.includes(s) : op === "odrl:isNoneOf" ? !rhs.includes(s) : false;
    }
    const parseBoundMs = (iso: string, endOfDay: boolean): number => {
      const t = iso.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        return Date.parse(endOfDay ? `${t}T23:59:59.999Z` : `${t}T00:00:00.000Z`);
      }
      return Date.parse(t);
    };
    const lhsMs = parseBoundMs(String(raw), false);
    const rhsMs = parseBoundMs(rhs, op === "odrl:lteq");
    if (Number.isNaN(lhsMs) || Number.isNaN(rhsMs)) return false;
    return compareNumbers(lhsMs, rhsMs, op);
  }

  if (left === "odrl:elapsedTime") {
    if (Array.isArray(rhs) || Array.isArray(raw)) return false;
    const lhsMs = parseDurationMs(raw as string | number);
    const rhsMs = parseDurationMs(rhs);
    if (lhsMs === undefined || rhsMs === undefined) return false;
    return compareNumbers(lhsMs, rhsMs, op);
  }

  const v = String(raw);
  switch (op) {
    case "odrl:eq":
      return !Array.isArray(rhs) && v === rhs;
    case "odrl:neq":
      return !Array.isArray(rhs) && v !== rhs;
    case "odrl:isAnyOf":
      return (rhs as string[]).includes(v);
    case "odrl:isNoneOf":
      return !(rhs as string[]).includes(v);
    case "odrl:lt":
      return !Array.isArray(rhs) && v < rhs;
    case "odrl:lteq":
      return !Array.isArray(rhs) && v <= rhs;
    case "odrl:gt":
      return !Array.isArray(rhs) && v > rhs;
    case "odrl:gteq":
      return !Array.isArray(rhs) && v >= rhs;
    case "odrl:isA":
      return !Array.isArray(rhs) && v === rhs;
    default:
      return false;
  }
}

function normalizeDutyAction(action: string): string {
  return action.startsWith("odrl:") ? action.slice("odrl:".length) : action;
}

function recordMatchesDutyAction(rec: ProvDutyRecord, dutyAction: OdrlDutyAction): boolean {
  const bare = normalizeDutyAction(dutyAction);
  const kebab = bare.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  const explicit = rec["odrl:action"] ?? rec.action;
  if (explicit !== undefined) {
    const normExplicit = normalizeDutyAction(explicit).toLowerCase();
    return normExplicit === bare.toLowerCase() || normExplicit === kebab;
  }
  const plan = rec["prov:qualifiedAssociation"]?.["prov:hadPlan"];
  if (plan !== undefined) {
    const fragment = (plan.includes("#") ? plan.split("#")[1] : plan) ?? "";
    const normTask = fragment.replace(/^(?:Task_|odrl[:._-])/i, "").toLowerCase();
    if (normTask === bare.toLowerCase() || normTask === kebab) return true;
  }
  if (bare === "delete" && (rec["prov:invalidated"]?.length ?? 0) > 0) return true;
  return false;
}

function dutyFulfilledByRecord(
  duty: OdrlDuty,
  rule: OdrlRule,
  policyUids: ReadonlySet<string>,
  rec: ProvDutyRecord,
): boolean {
  if (!recordMatchesDutyAction(rec, duty.action)) return false;
  const obligated = duty.assignee ?? rule.assignee;
  const agent = rec["prov:qualifiedAssociation"]?.["prov:agent"] ?? rec["prov:agent"];
  if (obligated !== ANYONE && agent !== undefined && agent !== obligated) return false;
  const under = rec["cat-harness:underPolicy"];
  if (under !== undefined) {
    const list = Array.isArray(under) ? under : [under];
    if (!list.some((u) => policyUids.has(u))) return false;
  }
  const target = duty.target ?? rule.target;
  if (target !== undefined) {
    const entities = [
      ...(rec["prov:used"] ?? []).map((u) => (typeof u === "string" ? u : u["@id"])),
      ...(rec["prov:invalidated"] ?? []),
      ...(rec.target ? [rec.target] : []),
    ];
    if (entities.length > 0 && !entities.includes(target)) return false;
  }
  return true;
}

type DutyStatus = "satisfied" | "unmet" | "unknowable";

interface DutyEvaluation {
  status: DutyStatus;
  consent?: ConsentDecisionRef;
}

function normalizeConsentEvaluation(input: ConsentEvaluation | Decision): ConsentEvaluation {
  return typeof input === "string" ? { verdict: input } : input;
}

function evaluateObtainConsentDuty(
  duty: OdrlDuty,
  rule: OdrlRule,
  policy: OdrlPolicy,
  policyUids: ReadonlySet<string>,
  req: PermitRequest,
  scope: RequestScope,
  records: readonly ProvDutyRecord[] | undefined,
): DutyEvaluation {
  const effectiveTarget = scope.target ?? duty.target ?? rule.target;
  const effectiveScope: RequestScope =
    effectiveTarget !== undefined && scope.target === undefined
      ? { ...scope, target: effectiveTarget }
      : scope;
  const effectiveReq: PermitRequest =
    effectiveScope === scope ? req : { ...req, scope: effectiveScope };

  const evaluator = req.consentEvaluator ?? scope.consentEvaluator;
  const verdictInput = req.consentVerdict ?? scope.consentVerdict;

  if (evaluator !== undefined || verdictInput !== undefined) {
    const evaluation = normalizeConsentEvaluation(
      evaluator !== undefined ? evaluator(effectiveReq, duty, rule, policy) : verdictInput!,
    );
    if (evaluation.verdict === "deny") {
      return { status: "unmet", consent: evaluation.consent };
    }
    if (evaluation.verdict === "unknown") {
      return { status: "unknowable", consent: evaluation.consent };
    }
    for (const c of duty.constraint ?? []) {
      if (scopeValue(c.leftOperand, effectiveScope) === undefined) {
        return { status: "unknowable", consent: evaluation.consent };
      }
      if (!constraintHolds(c, effectiveScope)) {
        return { status: "unmet", consent: evaluation.consent };
      }
    }
    return { status: "satisfied", consent: evaluation.consent };
  }

  if (records && records.some((rec) => dutyFulfilledByRecord(duty, rule, policyUids, rec))) {
    for (const c of duty.constraint ?? []) {
      if (scopeValue(c.leftOperand, effectiveScope) === undefined) return { status: "unknowable" };
      if (!constraintHolds(c, effectiveScope)) return { status: "unmet" };
    }
    return { status: "satisfied" };
  }

  // Bean a7c1 / 6jnx: DSA + no active consent evaluation gives unknown, never permit or deny.
  return { status: "unknowable" };
}

function evaluateDuty(
  duty: OdrlDuty,
  rule: OdrlRule,
  policy: OdrlPolicy,
  policyUids: ReadonlySet<string>,
  req: PermitRequest,
  scope: RequestScope,
  records: readonly ProvDutyRecord[] | undefined,
): DutyEvaluation {
  if (normalizeDutyAction(duty.action) === "obtainConsent") {
    return evaluateObtainConsentDuty(duty, rule, policy, policyUids, req, scope, records);
  }
  if (records && records.some((rec) => dutyFulfilledByRecord(duty, rule, policyUids, rec))) {
    return { status: "satisfied" };
  }
  const constraints = duty.constraint ?? [];
  if (constraints.length > 0) {
    if (constraints.some((c) => scopeValue(c.leftOperand, scope) === undefined)) {
      return { status: "unknowable" };
    }
    // Inside the duty's window (e.g. elapsedTime <= P90D): the deadline has not
    // passed yet, so the duty does not block the permission.
    if (constraints.every((c) => constraintHolds(c, scope))) {
      return { status: "satisfied" };
    }
  }
  // Duty is now due (either immediate or past its deadline window): without
  // PROV records its fulfilment is unknowable; with records and no match it is
  // unmet.
  return { status: records === undefined ? "unknowable" : "unmet" };
}

function ruleApplies(
  r: OdrlRule,
  who: string | null,
  action: string,
  scope: RequestScope,
  graph: ActionGraph,
): boolean {
  if (r.assignee !== ANYONE && r.assignee !== who) return false;
  if (!broaderOrSelf(action, graph).has(r.action)) return false;
  if (r.target !== undefined && r.target !== scope.target) return false;
  return (r.constraint ?? []).every((c) => constraintHolds(c, scope));
}

type PermissionOutcome = "no-match" | "permitted" | "violated" | "unknown";

interface RuleEvaluation {
  outcome: PermissionOutcome;
  consent?: ConsentDecisionRef;
}

function evaluatePermissionRule(
  r: OdrlRule,
  req: PermitRequest,
  policy: OdrlPolicy,
  scope: RequestScope,
  graph: ActionGraph,
  policyDuties: readonly OdrlDuty[],
  policyUids: ReadonlySet<string>,
  records: readonly ProvDutyRecord[] | undefined,
): RuleEvaluation {
  const who = req.actor;
  const action = req.action;
  if (r.assignee !== ANYONE && r.assignee !== who) return { outcome: "no-match" };
  if (!broaderOrSelf(action, graph).has(r.action)) return { outcome: "no-match" };
  if (r.target !== undefined && r.target !== scope.target) return { outcome: "no-match" };

  const constraints = r.constraint ?? [];
  const bpmnConstraints = constraints.filter((c) => isBpmnScopeOperand(c.leftOperand));
  if (!bpmnConstraints.every((c) => constraintHolds(c, scope))) return { outcome: "no-match" };

  const usageConstraints = constraints.filter((c) => !isBpmnScopeOperand(c.leftOperand));
  let usageUnknown = false;
  for (const c of usageConstraints) {
    if (scopeValue(c.leftOperand, scope) === undefined) {
      usageUnknown = true;
    } else if (!constraintHolds(c, scope)) {
      return { outcome: "violated" };
    }
  }
  if (usageUnknown) return { outcome: "unknown" };

  const duties = [...policyDuties, ...(r.duty ?? [])];
  let dutyUnknowable = false;
  let decidingConsent: ConsentDecisionRef | undefined;
  for (const d of duties) {
    const { status, consent } = evaluateDuty(d, r, policy, policyUids, req, scope, records);
    if (consent !== undefined) decidingConsent = consent;
    if (status === "unmet") return { outcome: "violated", consent: decidingConsent };
    if (status === "unknowable") dutyUnknowable = true;
  }
  if (dutyUnknowable) return { outcome: "unknown", consent: decidingConsent };
  return { outcome: "permitted", consent: decidingConsent };
}

export interface PermitRequest {
  /** The actor asking, or `null` for an unauthenticated reader. */
  actor: string | null;
  /** The roles the actor may act as (`ActorDef.roles`); empty or absent means unconstrained. */
  actorRoles?: readonly string[];
  /** Groups or organizations the actor belongs to. */
  actorGroups?: readonly string[];
  action: string;
  scope?: RequestScope;
  /**
   * PROV-O activity records used to verify whether duties on a matching
   * permission have been fulfilled. When omitted (`undefined`) and a duty is
   * due, `permits()` returns `"unknown"`.
   */
  provRecords?: readonly ProvDutyRecord[];
  /**
   * Injected consent evaluator invoked when a matching permission rule carries
   * an `odrl:obtainConsent` duty (beans `a7c1`, `6jnx`).
   */
  consentEvaluator?: ConsentEvaluator;
  /**
   * Pre-computed consent verdict (`permit` | `deny` | `unknown`, plus optional
   * citation) consulted when evaluating an `odrl:obtainConsent` duty (beans
   * `a7c1`, `6jnx`).
   */
  consentVerdict?: ConsentEvaluation | Decision;
}

export interface ConsentDecisionResult {
  decision: Decision;
  consent?: ConsentDecisionRef;
}

/**
 * Evaluate {@link permits} and also surface the deciding consent citation (if
 * an `odrl:obtainConsent` duty was evaluated via {@link ConsentEvaluator} or
 * `consentVerdict`, beans `a7c1`, `2egb`, `6jnx`).
 */
export function permitsWithConsent(
  req: PermitRequest,
  policy: OdrlPolicy,
  all: ReadonlyMap<string, OdrlPolicy>,
  graph: ActionGraph,
): ConsentDecisionResult {
  const scope = req.scope ?? {};
  const records = req.provRecords ?? scope.provRecords;
  const { permission, prohibition } = effectiveRules(policy, all);
  const policyUids = new Set<string>([policy.uid, ...(policy.inheritFrom ?? [])]);
  const policyDuties = policy.obligation ?? [];

  const evaluations = permission.map((r) =>
    evaluatePermissionRule(r, req, policy, scope, graph, policyDuties, policyUids, records),
  );
  const permittedEval = evaluations.find((e) => e.outcome === "permitted");
  const violatedEval = evaluations.find((e) => e.outcome === "violated");
  const unknownEval = evaluations.find((e) => e.outcome === "unknown");
  const permitted = permittedEval !== undefined;
  const violated = violatedEval !== undefined;
  const prohibited = prohibition.some((r) => ruleApplies(r, req.actor, req.action, scope, graph));

  const withRef = (decision: Decision, ref?: ConsentDecisionRef): ConsentDecisionResult =>
    ref !== undefined ? { decision, consent: ref } : { decision };

  if (prohibited && permitted) {
    const strategy = policy.conflict ?? FOLIO_DEFAULT_CONFLICT;
    if (strategy !== "odrl:perm") return withRef("deny", permittedEval?.consent);
  } else if (prohibited) {
    return { decision: "deny" };
  } else if (!permitted) {
    return violated
      ? withRef("deny", violatedEval?.consent)
      : withRef("unknown", unknownEval?.consent);
  }

  const role = scope["cat-harness:role"];
  if (role && req.actorRoles && req.actorRoles.length > 0 && !req.actorRoles.includes(role)) {
    return withRef("deny", permittedEval?.consent);
  }
  return withRef("permit", permittedEval?.consent);
}

/**
 * May this actor do this, here? Evaluated against one policy and everything it
 * inherits.
 *
 * - A matching prohibition and no matching permission: `deny`.
 * - A matching permission whose usage constraint (`purpose`, `dateTime`,
 *   `elapsedTime`) is violated or whose due duty is unmet: `deny`.
 * - A matching permission whose usage constraint or due duty cannot be
 *   determined from the provided scope / PROV records / consent evaluator:
 *   `unknown`.
 * - A matching permission with all constraints and duties satisfied and no
 *   prohibition: `permit`, unless the request names a `cat-harness:role` the
 *   actor is not eligible for.
 * - Both: the policy's `conflict` decides (the folio default is
 *   `odrl:prohibit`); `odrl:invalid` voids the policy, which is `deny`.
 * - Neither: `unknown`.
 */
export function permits(
  req: PermitRequest,
  policy: OdrlPolicy,
  all: ReadonlyMap<string, OdrlPolicy>,
  graph: ActionGraph,
): Decision {
  return permitsWithConsent(req, policy, all, graph).decision;
}

/**
 * Every action an actor holds with NO scope: the old `permissions: [...]`
 * list, derived from the policies instead of stored on the actor. What the
 * existing readers (kg-audit, kg-export, the QA-reviewer gate) consume while
 * they move to {@link permits}.
 */
export function unscopedGrants(
  policy: OdrlPolicy,
  all: ReadonlyMap<string, OdrlPolicy>,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of effectiveRules(policy, all).permission) {
    if (
      r.assignee === ANYONE ||
      r.target !== undefined ||
      (r.constraint ?? []).length > 0 ||
      (r.duty ?? []).length > 0
    ) {
      continue;
    }
    const list = out.get(r.assignee) ?? [];
    if (!list.includes(r.action)) list.push(r.action);
    out.set(r.assignee, list);
  }
  return out;
}

/**
 * Every actor's unscoped grants across every policy in a directory: the
 * `permissions` list the readers of actor files used to find on the actor.
 * `readActors(dir, readPolicyGrants(policiesDir))` restores it for them.
 */
export function readPolicyGrants(dir: string): Map<string, string[]> {
  return policyGrants(readPolicies(dir));
}

/**
 * {@link readPolicyGrants} over policies already read — from one directory, or
 * from several layers' directories overlaid into one map.
 */
export function policyGrants(all: ReadonlyMap<string, OdrlPolicy>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const policy of all.values()) {
    for (const [actor, actions] of unscopedGrants(policy, all)) {
      const list = out.get(actor) ?? [];
      for (const a of actions) if (!list.includes(a)) list.push(a);
      out.set(actor, list);
    }
  }
  return out;
}

/**
 * The action every BPMN task execution asks for (owner, 2026-09-23, issue
 * #1207): one action for every task, narrowed by the `cat-harness:process`,
 * `cat-harness:task` and `cat-harness:role` constraints a rule carries and by
 * its `target`. A task that needs a more specific right says so in the POLICY,
 * as a constrained `perform-task` rule, never in the diagram.
 */
export const PERFORM_TASK = "perform-task" as const;

/**
 * {@link decide} together with the deciding consent citation (when an
 * `odrl:obtainConsent` duty was evaluated via {@link ConsentEvaluator} or
 * `consentVerdict`).
 */
export function decideWithConsent(
  req: PermitRequest,
  all: ReadonlyMap<string, OdrlPolicy>,
  graph: ActionGraph,
): ConsentDecisionResult {
  let permitted = false;
  let permitConsent: ConsentDecisionRef | undefined;
  let unknownConsent: ConsentDecisionRef | undefined;
  for (const policy of all.values()) {
    const res = permitsWithConsent(req, policy, all, graph);
    if (res.decision === "deny") return res;
    if (res.decision === "permit") {
      permitted = true;
      if (permitConsent === undefined && res.consent !== undefined) {
        permitConsent = res.consent;
      }
    } else if (unknownConsent === undefined && res.consent !== undefined) {
      unknownConsent = res.consent;
    }
  }
  if (permitted) {
    return permitConsent !== undefined ? { decision: "permit", consent: permitConsent } : { decision: "permit" };
  }
  return unknownConsent !== undefined ? { decision: "unknown", consent: unknownConsent } : { decision: "unknown" };
}

/**
 * {@link permits} across every policy a layer holds, which is the question
 * a caller actually has: not "does this one policy allow it" but "does
 * anything here speak to it". A `deny` from any policy wins (the folio default
 * conflict strategy is `odrl:prohibit`, and a prohibition in one file must not
 * be outvoted by a permission in another); otherwise any `permit` permits; and
 * silence everywhere stays `unknown`, never permit.
 */
export function decide(
  req: PermitRequest,
  all: ReadonlyMap<string, OdrlPolicy>,
  graph: ActionGraph,
): Decision {
  return decideWithConsent(req, all, graph).decision;
}
