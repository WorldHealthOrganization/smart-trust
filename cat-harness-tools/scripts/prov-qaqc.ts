/**
 * The QA/QC report over PROV-O: the agentic engine's after-check.
 *
 * The deterministic engine checks the ODRL policy BEFORE a task and refuses
 * (`src/workflow/authorize.ts`). An agent swarm acts first, so the same
 * policy is checked AFTER, from the record of what was done.
 *
 * For every workflow instance in `beans/workflows/` (and every subprocess
 * instance inside it), for each history entry whose node is an activity or a
 * decision in its process model:
 *
 * 1. **The record.** One `prov:Activity`, validated by `ProvActivitySchema`:
 *    `prov:agent` is the entry's actor, `prov:hadRole` the role the node's
 *    lane binds (`laneBinding`), `prov:hadPlan` `<process stem>#<node id>`,
 *    `prov:startedAtTime` the entry's `at`, and `cat-harness:underPolicy` the
 *    uid(s) of every policy evaluated. Written per instance to
 *    `docs/assets/prov/<instance>.prov.jsonld`.
 * 2. **The check.** `authorizeTask`, the before-check itself, re-run with the
 *    principal `asserted`, because history records only a name. Nothing is
 *    re-implemented here.
 *
 * ## Nothing is invented
 *
 * `ProvAssociationSchema` requires `prov:agent` and `prov:hadRole` (stricter
 * than PROV-O, where `hadRole` is optional; the page says so). An entry with
 * no actor, or in a lane that binds no role, cannot honestly fill them, so NO
 * activity is emitted for it and the gap is a finding (`no-actor`,
 * `no-role`).
 *
 * ## Advisory: findings do not fail the build
 *
 * A finding is reported, never fatal (as in `authorize.ts`). `--check` fails
 * only on stale outputs, a `prov:Activity` that does not validate, or an
 * internal error (a process model that cannot be loaded). `unknown` is never
 * read as permit.
 *
 * ## Which site: the layer whose instances it reads
 *
 * The instances are the checkout ROOT's (`beans/workflows/`), so the outputs
 * are the root's too (owner, 2026-11-17). When the root declares a layer, the
 * page and logs are written to and checked in THAT layer's own site, never in
 * a mounted dependency's. Before this, a downstream layer (dth-pc, with no
 * instances) judged cat-harness's committed logs against its own empty work
 * plan and found every one an orphan. A root that declares no layer (a bare
 * index such as folio-assistant's) has no site of its own, so its report stays
 * in the platform site, as before. A root layer with no instance owes no
 * report: nothing is written, and only a report it already committed is
 * judged.
 *
 * ## Instances kept on a state branch: derived, not committed
 *
 * When the root's `beans` graph is kept on its own branch
 * (`cat/<instance>/beans`, mounted by `state:mount`), the instances are not
 * in any commit of the layer, and they move whenever a workflow advances. A
 * page and logs committed over them would be stale the moment the branch
 * moved, and no commit to the layer can follow it (WHO dth-pc#3, run
 * 44489690657: the beans branch copied in with a content-change-review
 * instance, and the gate asked for PROV outputs no folio commit could keep
 * current). So under a mounted graph an output the layer has NOT committed
 * is derived at check time, not a finding: `--check` still builds the whole
 * report and still fails on a `prov:Activity` that does not validate or on
 * an internal error, and `prov:qaqc` still writes the outputs for a site
 * build to publish. An output the layer HAS committed is still judged, stale
 * or orphaned, as before: cat-harness keeps its beans on a branch too and
 * commits its logs, which the index gate exists to keep current
 * (cat-harness-tools#1417). Instances tracked in the checkout are judged
 * exactly as before.
 *
 * ## Records in the earlier shape
 *
 * An instance file without `id` and `source` (the earlier
 * `folio-workflow-instance/v1` shape: `instanceId`, `bpmnPath`, history keyed
 * by `elementId`) is listed with one `legacy-record` finding and not walked;
 * its row on the page appears only when one occurs.
 *
 * Usage:  bun run cat-harness-tools/scripts/prov-qaqc.ts [--check]
 *
 * @module cat-harness/scripts/prov-qaqc
 * @covers workflow-state, policies, scenarios — it re-checks the ODRL policy AFTER the fact
 *   from the workflow record, so its subjects are the instance state, the policies it grades
 *   against, and the role graph naming the actors
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import { layerRootsIn, repoRootFor, siteDirFor } from "../schemas/kg/cat-harness.js";
import { findDeclarationFile } from "../schemas/kg/instance-roots.js";
import { addressBook, provJsonldDocument, type AddressBook, type SubjectMinter } from "../schemas/kg/prov-jsonld.js";
import { ProvActivitySchema, ProvConsentRefSchema, agreementsCited, isConsentBasedRecord, isConsentPolicyUid, verifyProvHashChain, type ProvActivity } from "../schemas/content/prov.js";
import { actorsDir, laneBinding, type RoleGraph } from "../schemas/process/role-graph.js";
import { loadAccessContext, type AccessContext, type Principal } from "../src/core/access.js";
import { authorizeTask, type TaskAuthVerdict } from "../src/workflow/authorize.js";
import type { HistoryEntry, InstanceState } from "../src/workflow/instance.js";
import { isActivity, isDecision, loadProcessModel, processDiagrams, type ProcessModel } from "../src/workflow/process-model.js";
import { listInstances, workflowStateAbsent } from "../src/workflow/store.js";
import { roleGraphFor, workflowFiles, corpusScopeFor } from "./known-skills.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { exportIdentity, publishedIdentity } from "./kg-export.ts";
import { graphReadPath } from "./graph-read.ts";
import { subjectIri } from "./lib/subject-iri.ts";

const HARNESS = resolve(HARNESS_ROOT);
const REPO = repoRootFor(HARNESS);
/**
 * Where the report is published: the site of the layer whose instances it
 * reads. The checkout root's own declared site when the root declares a layer;
 * the platform's when the root is a bare index with no layer of its own. Never
 * a literal, and never a mounted dependency's site under a root that has one.
 */
export function reportSite(repo: string = REPO, harness: string = HARNESS): { site: string; page: string; assets: string; rootLayer: boolean } {
  const rootLayer = findDeclarationFile(repo) !== undefined;
  const owner = rootLayer ? repo : harness;
  const site = join(owner, siteDirFor(owner));
  return { site, page: join(site, "prov-qaqc", "index.md"), assets: join(site, "assets", "prov"), rootLayer };
}
const SITE = reportSite();
export const PAGE = SITE.page;
export const ASSETS = SITE.assets;

/** The PROV-O namespace. `prov:` in every term below expands to it. */
export const PROV_NS = "http://www.w3.org/ns/prov#";

export const FINDING_KINDS = [
  "no-actor",
  "no-role",
  "undeclared-actor",
  "not-eligible",
  "unknown",
  "deny",
  "authz-disagrees",
  "node-not-in-model",
  "source-moved",
  "source-missing",
  "unaddressed",
  "legacy-record",
] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

/** What each kind means, for the page. */
export const FINDING_MEANING: Readonly<Record<FindingKind, string>> = {
  "no-actor": "the entry names nobody; no activity is emitted, because `prov:agent` is required and would have to be invented",
  "no-role": "the node's lane binds no role; no activity is emitted, because `ProvActivitySchema` requires `prov:hadRole` (PROV-O itself does not)",
  "undeclared-actor": "the actor is not declared in `cat-harness/scenarios/actors/`",
  "not-eligible": "the actor's `roles` do not include the role the lane binds",
  unknown: "no ODRL policy grants `perform-task` here; `unknown` is never permit",
  deny: "an ODRL policy prohibits `perform-task` here",
  "authz-disagrees": "the verdict recorded in the entry's `authz` differs from the one recomputed now",
  "node-not-in-model": "the entry names a node its process model does not have",
  "source-moved":
    "the `.bpmn` the instance recorded is gone; the diagram was found by file name, as `workflow_start` resolves one, and its process id matches the instance's",
  "source-missing": "the `.bpmn` the instance recorded is gone and no diagram with that name and process id exists; nothing in it can be checked",
  unaddressed:
    "the agent, role or plan has no release address — its owning instance declares no `iriBase`, or no instance declares it — so the PROV-JSONLD record carries it as a literal, not a link (`linked-data` voice, `ld-link-is-the-node-release-address`)",
  "legacy-record":
    "the instance file is in the earlier record shape (`instanceId`, `bpmnPath`, history entries keyed by `elementId`), not the one `workflow_start` writes (`id`, `source`, entries keyed by `node`); it is listed, and nothing in it is checked",
};

/** Kinds whose row the page shows only when one occurs, so a page with none is unchanged by their addition. */
const SHOWN_WHEN_PRESENT: ReadonlySet<FindingKind> = new Set(["legacy-record"]);

/**
 * A workflow instance file as read, in either shape. `workflow_start` writes
 * `id` and `source`; records written before it (the earlier
 * `folio-workflow-instance/v1` shape) carry `instanceId` and `bpmnPath`, and
 * their history entries name `elementId`, not `node`.
 */
type ReadInstance = InstanceState & { instanceId?: string; bpmnPath?: string };

/** The instance's id in either shape; `""` when it carries neither. */
export function instanceIdOf(s: ReadInstance): string {
  return typeof s.id === "string" && s.id ? s.id : typeof s.instanceId === "string" ? s.instanceId : "";
}

/**
 * True when `s` is in the shape this report reads: an `id`, a `source`, and a
 * history whose every entry names its `node`. Anything else is reported as a
 * `legacy-record` finding instead of being walked, so one old file cannot
 * stop the report (it used to throw on `a.id.localeCompare`).
 */
export function isCurrentShape(s: ReadInstance): boolean {
  return (
    typeof s.id === "string" &&
    s.id !== "" &&
    typeof s.source === "string" &&
    Array.isArray(s.history) &&
    s.history.every((h) => typeof (h as { node?: unknown }).node === "string")
  );
}

export interface Finding {
  instance: string;
  /** Index of the entry in its instance's `history`; -1 for a finding about the instance itself. */
  entry: number;
  node: string;
  kind: FindingKind;
  detail: string;
}

export interface InstanceReport {
  /** The instance id; a subprocess is `<parent>/<call activity>`. */
  id: string;
  /** Repo-relative path of the `.bpmn`. */
  source: string;
  activities: ProvActivity[];
  findings: Finding[];
  /** Activities or decisions in history, whether or not an activity was emitted. */
  checked: number;
}

export interface Report {
  /** Top-level instance id → its reports (itself first, then its subprocesses). */
  instances: Map<string, InstanceReport[]>;
  policies: string[];
  /** Activities that did not validate. Fatal under `--check`. */
  invalid: string[];
}

/** `code-change-review.bpmn` → `code-change-review`, lower-case so it satisfies `PLAN_REF`. */
export function processStem(source: string): string {
  return basename(source).replace(/\.bpmn$/i, "").toLowerCase();
}

/** JSON with every object's keys sorted, so the output is byte-stable. */
export function stableJson(v: unknown): string {
  const sort = (x: unknown): unknown =>
    Array.isArray(x)
      ? x.map(sort)
      : x && typeof x === "object"
        ? Object.fromEntries(
            Object.keys(x as Record<string, unknown>)
              .sort()
              .map((k) => [k, sort((x as Record<string, unknown>)[k])]),
          )
        : x;
  return `${JSON.stringify(sort(v), null, 2)}\n`;
}

/** The role the node's lane binds, or why there is none. */
function laneRole(model: ProcessModel, nodeId: string, graph: RoleGraph | undefined): { role?: string; why?: string } {
  const node = model.nodes.get(nodeId)!;
  const lane = model.lanes.find((l) => l.id === node.laneId);
  if (!lane) return { why: "the node sits in no lane" };
  if (!graph) return { why: "no role graph is declared, so no lane's binding can be judged" };
  const b = laneBinding(graph, lane);
  switch (b.kind) {
    case "bound":
      return { role: b.role.id };
    case "variable":
      return { why: `lane "${lane.name ?? lane.id}" declares that its performer varies` };
    case "dangling":
      return { why: `lane "${lane.name ?? lane.id}" names role "${b.ref}", which is not declared` };
    case "contradictory":
      return { why: `lane "${lane.name ?? lane.id}" both names role "${b.ref}" and says its performer varies` };
    default:
      return { why: `lane "${lane.name ?? lane.id}" binds no role` };
  }
}

/** The fields of a recorded verdict the recomputed one must agree with. */
function disagreement(recorded: TaskAuthVerdict, now: TaskAuthVerdict): string | undefined {
  const diffs: string[] = [];
  if (recorded.authorized !== now.authorized) diffs.push(`policy ${recorded.authorized} → ${now.authorized}`);
  if (recorded.assignment !== now.assignment) diffs.push(`assignment ${recorded.assignment} → ${now.assignment}`);
  if ((recorded.role ?? null) !== (now.role ?? null)) diffs.push(`role ${recorded.role ?? "(none)"} → ${now.role ?? "(none)"}`);
  if (recorded.allowed !== now.allowed) diffs.push(`allowed ${recorded.allowed} → ${now.allowed}`);
  return diffs.length ? `recorded vs recomputed: ${diffs.join("; ")}` : undefined;
}

/**
 * One instance's history, as PROV activities and findings. Pure apart from
 * its inputs: the model, the role graph and the access context are supplied.
 */
export function reportInstance(
  id: string,
  state: Pick<InstanceState, "source" | "history">,
  model: ProcessModel,
  graph: RoleGraph | undefined,
  ctx: AccessContext,
): InstanceReport & { invalid: string[] } {
  const activities: ProvActivity[] = [];
  const findings: Finding[] = [];
  const invalid: string[] = [];
  const policies = [...ctx.policies.keys()].sort();
  const stem = processStem(state.source);
  let checked = 0;

  state.history.forEach((h: HistoryEntry, i) => {
    const add = (kind: FindingKind, detail: string) => findings.push({ instance: id, entry: i, node: h.node, kind, detail });
    const node = model.nodes.get(h.node);
    if (!node) {
      add("node-not-in-model", `${h.node} is not a node of ${model.id} as the diagram now stands`);
      return;
    }
    if (!isActivity(node) && !isDecision(node)) return;
    checked++;

    const { role, why } = laneRole(model, h.node, graph);
    // Since the engine went strict (bean `n2l9`), an entry recorded under a
    // verdict carries the principal that verdict was computed for: the actor
    // GitHub vouched for, not the name the caller typed (which may be a login).
    // Re-check THAT. An entry without one records only a name, which is
    // asserted and nothing more.
    const actor = (h.authz ? h.authz.actor : h.actor?.trim()) || null;
    const principal: Principal = h.authz
      ? { actor: h.authz.actor, authenticatedBy: h.authz.authenticatedBy, account: h.authz.account }
      : actor
        ? { actor, authenticatedBy: "asserted" }
        : { actor: null, authenticatedBy: "none" };
    const v = authorizeTask(ctx, { principal, process: model.id, task: h.node, ...(role ? { role } : {}) });

    if (!actor) add("no-actor", "no actor recorded; no prov:Activity emitted rather than an invented prov:agent");
    if (!role) add("no-role", `${why}; no prov:Activity emitted rather than an invented prov:hadRole`);
    if (v.assignment === "unknown-actor") add("undeclared-actor", `"${actor}" is not a declared actor`);
    if (v.assignment === "not-eligible") {
      const roles = ctx.actors.get(actor!)?.roles ?? [];
      add("not-eligible", `${actor} may act as ${roles.join(", ")}, not as ${role}`);
    }
    if (v.authorized === "unknown") add("unknown", `no policy grants perform-task for ${model.id}/${h.node}${role ? ` as ${role}` : ""}`);
    if (v.authorized === "deny") add("deny", `a policy prohibits perform-task for ${model.id}/${h.node}${role ? ` as ${role}` : ""}`);
    if (h.authz) {
      const d = disagreement(h.authz, v);
      if (d) add("authz-disagrees", d);
    }

    if (!actor || !role || policies.length === 0) return;
    // The engine's own record, written as the step was recorded, is the
    // authority when it exists; deriving one is for entries that predate it.
    const activity = h.prov ?? {
      "@type": "prov:Activity" as const,
      "@id": `${id}#${i}`,
      "prov:startedAtTime": h.at,
      "prov:qualifiedAssociation": {
        "prov:agent": actor,
        "prov:hadRole": role,
        "prov:hadPlan": `${stem}#${h.node}`,
      },
      "cat-harness:underPolicy": policies.length === 1 ? policies[0]! : policies,
    };
    const consentPolicyUids = new Set<string>(
      [...ctx.policies.values()]
        .filter((p) => {
          if (isConsentPolicyUid(p.uid)) return true;
          const duties = [
            ...((p as { obligation?: readonly { action?: string }[] }).obligation ?? []),
            ...p.permission.flatMap((rule) => (rule as { duty?: readonly { action?: string }[] }).duty ?? []),
          ];
          return duties.some((d) => d.action === "odrl:obtainConsent" || d.action === "obtainConsent");
        })
        .map((p) => p.uid),
    );
    const actRecord = activity as unknown as Record<string, unknown>;
    if (
      isConsentBasedRecord(actRecord, { consentPolicyUids }) &&
      !ProvConsentRefSchema.safeParse(actRecord["cat-harness:consent"]).success
    ) {
      invalid.push(
        `${id}#${i}: missing-consent: consent-based decision record does not name a valid cat-harness:consent (id + versionId)`,
      );
    }
    const r = ProvActivitySchema.safeParse(activity);
    if (r.success) activities.push(r.data);
    else invalid.push(`${id}#${i}: ${r.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
  });

  const consentPolicyUids = new Set<string>(
    [...ctx.policies.values()]
      .filter((p) => {
        if (isConsentPolicyUid(p.uid)) return true;
        const duties = [
          ...((p as { obligation?: readonly { action?: string }[] }).obligation ?? []),
          ...p.permission.flatMap((rule) => (rule as { duty?: readonly { action?: string }[] }).duty ?? []),
        ];
        return duties.some((d) => d.action === "odrl:obtainConsent" || d.action === "obtainConsent");
      })
      .map((p) => p.uid),
  );
  const hasChainedOrAgreement = activities.some(
    (a) =>
      a["cat-harness:recordHash"] !== undefined ||
      a["cat-harness:previousHash"] !== undefined ||
      agreementsCited(a).length > 0,
  );
  if (hasChainedOrAgreement) {
    const requireAgreement = activities.some((a) => agreementsCited(a).length > 0);
    const chainCheck = verifyProvHashChain(activities, { requireAgreement, consentPolicyUids });
    if (!chainCheck.valid) {
      for (const err of chainCheck.errors) {
        invalid.push(`${err.id ?? `${id}#${err.index}`}: ${err.kind}: ${err.detail}`);
      }
    }
  }

  return { id, source: state.source, activities, findings, checked, invalid };
}

/**
 * Where an instance's diagram is now. The recorded `source` when it exists;
 * otherwise the declared diagram with the same file name AND the same process
 * id (the rule `workflow_start` resolves a stem by, plus the id so a
 * different process that happens to share a name is not taken for it).
 */
async function locate(
  repo: string,
  state: Pick<InstanceState, "source" | "processId">,
  candidates: () => string[],
): Promise<{ path: string; moved: boolean } | undefined> {
  const recorded = isAbsolute(state.source) ? state.source : join(repo, state.source);
  if (existsSync(recorded)) return { path: recorded, moved: false };
  const stem = basename(state.source);
  for (const f of candidates().filter((c) => basename(c) === stem).sort()) {
    if ((await loadProcessModel(f)).id === state.processId) return { path: f, moved: true };
  }
  return undefined;
}

/** Every instance in `repo`, its subprocesses included, sorted by id. */
export async function buildReport(
  repo: string = REPO,
  opts: { ctx?: AccessContext; graph?: RoleGraph; instances?: InstanceState[]; diagrams?: string[] } = {},
): Promise<Report> {
  // Only this layer's own policies: the output is committed in cat-harness,
  // and a lower layer's file must not name a higher layer's policy.
  const ctx = opts.ctx ?? loadAccessContext(HARNESS, { dependents: false });
  const graph = "graph" in opts ? opts.graph : roleGraphFor(HARNESS);
  let diagrams: string[] | undefined = opts.diagrams;
  const candidates = () => (diagrams ??= processDiagrams(workflowFiles(HARNESS, corpusScopeFor(HARNESS))));
  const models = new Map<string, Promise<ProcessModel>>();
  const model = (p: string) => {
    if (!models.has(p)) models.set(p, loadProcessModel(p));
    return models.get(p)!;
  };

  let addresses: AddressBook | undefined;
  const book = () => (addresses ??= addressBook(repo));
  const instances = new Map<string, InstanceReport[]>();
  const invalid: string[] = [];
  const all = (opts.instances ?? listInstances(repo))
    .map((s, i) => ({ s: s as ReadInstance, key: instanceIdOf(s as ReadInstance) || `(unnamed instance ${i + 1})` }))
    .sort((a, b) => a.key.localeCompare(b.key, "en"));
  for (const { s: top, key } of all) {
    if (!isCurrentShape(top)) {
      const source = typeof top.source === "string" ? top.source : typeof top.bpmnPath === "string" ? top.bpmnPath : "";
      const finding: Finding = {
        instance: key,
        entry: -1,
        node: typeof top.processId === "string" ? top.processId : "",
        kind: "legacy-record",
        detail: `${key} is in the earlier record shape (no \`id\`/\`source\`, or history entries without \`node\`); not checked`,
      };
      instances.set(key, [{ id: key, source, activities: [], checked: 0, findings: [finding] }]);
      continue;
    }
    const out: InstanceReport[] = [];
    const walk = async (id: string, s: InstanceState) => {
      const where = await locate(repo, s, candidates);
      const note = (kind: FindingKind, detail: string): Finding => ({ instance: id, entry: -1, node: s.processId, kind, detail });
      if (!where) {
        out.push({ id, source: s.source, activities: [], checked: 0, findings: [note("source-missing", `${s.source} does not exist, and no declared diagram of that name defines ${s.processId}`)] });
      } else {
        const r = reportInstance(id, s, await model(where.path), graph, ctx);
        invalid.push(...r.invalid);
        const moved = where.moved
          ? [note("source-moved", `${s.source} does not exist; read ${relative(repo, where.path).split("\\").join("/")}, which defines ${s.processId}`)]
          : [];
        const part = { id: r.id, source: r.source, activities: r.activities, findings: [...moved, ...r.findings], checked: r.checked };
        part.findings.push(...addressFindings(part, book()));
        out.push(part);
      }
      for (const k of Object.keys(s.children ?? {}).sort()) await walk(`${id}/${k}`, s.children![k]!);
    };
    await walk(top.id, top);
    instances.set(top.id, out);
  }
  return { instances, policies: [...ctx.policies.keys()].sort(), invalid };
}

/**
 * Mints a subject in the published knowledge graph of the layer that owns
 * it: `<doc dir>/<kind>/<id>`, against the document the deploy writes for
 * that layer (`publishedIdentity` at the host's base), so the IRI is the
 * page `kg-export` serves for it (issue #959).
 *
 * An actor is the exception: `kg-export` publishes the actor registry it
 * reads at the checkout root (`actorsDir`), in the document of the layer
 * holding it, and no other. An actor only another layer declares has no
 * page, so it gets no subject rather than an address nobody serves.
 */
export function publishedSubjects(repo: string = REPO): SubjectMinter {
  const base = exportIdentity({}).base;
  const docs = new Map<string, string>();
  const docOf = (root: string): string => {
    if (!docs.has(root)) docs.set(root, publishedIdentity(root, base || undefined).docIri);
    return docs.get(root)!;
  };
  const actors = actorsDir(repo);
  const actorHome = actors ? layerRootsIn(repo).filter((r) => actors.startsWith(`${r}/`)).sort((a, b) => b.length - a.length)[0] : undefined;
  return (root, kind, id) => {
    if (kind !== "actor") return subjectIri(docOf(root), kind, id);
    if (!actors || !actorHome || !existsSync(join(actors, `${id}.json`))) return undefined;
    return subjectIri(docOf(actorHome), kind, id);
  };
}

export function provDocument(id: string, parts: InstanceReport[], book: AddressBook = addressBook(REPO, publishedSubjects())): Record<string, unknown> {
  return provJsonldDocument(id, parts.flatMap((p) => p.activities), book).document;
}

/**
 * The `unaddressed` findings for one instance's activities: what the PROV-JSONLD
 * record had to carry as a literal, and why. Entry index is the `#<n>` the
 * activity id ends in.
 */
export function addressFindings(part: InstanceReport, book: AddressBook): Finding[] {
  return provJsonldDocument(part.id, part.activities, book).unaddressed.map((u) => {
    const n = Number(u.activity.slice(u.activity.lastIndexOf("#") + 1));
    return { instance: part.id, entry: Number.isInteger(n) ? n : -1, node: u.value, kind: "unaddressed" as const, detail: `${u.kind}: ${u.why}` };
  });
}

export function assetName(id: string): string {
  return `${id}.prov.jsonld`;
}

export function totals(r: Report): { checked: number; activities: number; byKind: Record<FindingKind, number> } {
  const byKind = Object.fromEntries(FINDING_KINDS.map((k) => [k, 0])) as Record<FindingKind, number>;
  let checked = 0;
  let activities = 0;
  for (const parts of r.instances.values()) {
    for (const p of parts) {
      checked += p.checked;
      activities += p.activities.length;
      for (const f of p.findings) byKind[f.kind]++;
    }
  }
  return { checked, activities, byKind };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[\\|]/g, "\\$&");

export function renderPage(r: Report): string {
  const t = totals(r);
  const totalFindings = FINDING_KINDS.reduce((n, k) => n + t.byKind[k], 0);
  const kindRows = FINDING_KINDS.filter((k) => !SHOWN_WHEN_PRESENT.has(k) || t.byKind[k] > 0)
    .map((k) => `| \`${k}\` | ${t.byKind[k]} | ${FINDING_MEANING[k]} |`)
    .join("\n");
  const sections = [...r.instances].map(([top, parts]) => {
    const n = parts.reduce((a, p) => a + p.findings.length, 0);
    const acts = parts.reduce((a, p) => a + p.activities.length, 0);
    const checked = parts.reduce((a, p) => a + p.checked, 0);
    const rows = parts.flatMap((p) =>
      p.findings.map((f) => `| \`${esc(p.id)}\` | ${f.entry < 0 ? "(instance)" : f.entry} | \`${esc(f.node)}\` | \`${f.kind}\` | ${esc(f.detail)} |`),
    );
    return [
      `### ${top}`,
      "",
      `${checked} step(s) checked, ${acts} \`prov:Activity\` emitted, ${n} finding(s). ` +
        `Source${parts.length > 1 ? "s" : ""}: ${parts.map((p) => `\`${p.source}\``).join(", ")}. ` +
        `[PROV JSON-LD]({{ '/assets/prov/${assetName(top)}' | relative_url }})`,
      "",
      ...(rows.length
        ? ["| instance | entry | node | finding | detail |", "|---|---|---|---|---|", ...rows]
        : ["No findings."]),
    ].join("\n");
  });
  return `---
layout: default
title: PROV-O QA/QC report
nav_order: 91
permalink: /prov-qaqc/
---
<!-- Generated by cat-harness-tools/scripts/prov-qaqc.ts. Do not hand-edit: \`check:prov-qaqc\` fails on the difference. -->

# PROV-O QA/QC report

The after-check for the agentic engine (issue #1180, step 5). The deterministic engine checks the ODRL policy **before** a task and refuses. An agent swarm acts first, so this report checks the **same** policy **after** the fact. It reads each workflow instance's history, writes it as W3C PROV-O, and re-runs \`authorizeTask\`, the before-check, on every step. Because history records only a name, the actor is treated as \`asserted\`.

**Advisory.** The owner chose advisory first (2026-09-23), so findings are reported here and do not fail the build. \`check:prov-qaqc\` fails only when these outputs are stale, when a \`prov:Activity\` does not validate against \`ProvActivitySchema\`, or on an internal error. \`unknown\` is never read as permit.

**Nothing is invented.** An entry with no actor, or in a lane that binds no role, gets no \`prov:Activity\`, because the schema requires \`prov:agent\` and \`prov:hadRole\`. It gets a finding instead. Every entry is \`asserted\`, so that is not listed as a finding.

**\`prov:hadRole\` stays required.** PROV-O makes it optional, and the owner decided on 2026-09-24 to keep it required here anyway ("Keep required"): a step in a lane that binds no role is reported as \`no-role\`, never logged without a role.

## Totals

${r.instances.size} instance(s), ${t.checked} step(s) checked, ${t.activities} \`prov:Activity\` emitted, ${totalFindings} finding(s). Policies evaluated: ${r.policies.map((p) => `\`${p}\``).join(", ") || "none"}.

| finding | count | means |
|---|---|---|
${kindRows}

## By instance

${sections.join("\n\n")}

## Regenerate

\`bun run cat prov:qaqc\` writes this page and the logs under \`assets/prov/\`. \`bun run cat check:prov-qaqc\` checks that they are current.
`;
}

/**
 * Every file this generator owns, path → content. A ROOT LAYER with no
 * instance owes no report: it gets the page only if it already committed one
 * (so a report that emptied is still kept current), and no logs.
 */
export function outputs(
  r: Report,
  site: { page: string; assets: string; rootLayer?: boolean } = SITE,
): Map<string, string> {
  if (site.rootLayer && r.instances.size === 0 && !existsSync(site.page)) return new Map();
  const out = new Map<string, string>([[site.page, renderPage(r)]]);
  const book = addressBook(REPO, publishedSubjects());
  for (const [id, parts] of r.instances) out.set(join(site.assets, assetName(id)), stableJson(provDocument(id, parts, book)));
  return out;
}

/**
 * The branch the root's instances are read from, when the `beans` graph that
 * holds them is mounted from one (`cat/<instance>/beans`); `undefined` when
 * they are tracked in the checkout (or the graph is not a branch-kept one).
 * Under a mounted graph the outputs are derived at check time (the header).
 */
export function instancesOnStateBranch(repo: string = REPO): string | undefined {
  const r = graphReadPath("beans", repo);
  if (r.state !== "ok" || r.from !== "mount") return undefined;
  return r.path;
}

/**
 * What `--check` judges: stale and orphaned outputs. When the instances are
 * on a state branch, an output that is not on disk (never committed) is
 * derived at check time and owed by nobody; one that is on disk is still
 * judged, and so is an orphan (the header).
 */
export function judged(
  files: Map<string, string>,
  onBranch: string | undefined,
  assets: string = ASSETS,
): { stale: string[]; orphans: string[] } {
  const r = staleness(files, assets);
  return onBranch === undefined ? r : { stale: r.stale.filter((p) => existsSync(p)), orphans: r.orphans };
}

/** Stale and orphaned outputs, relative to what `files` says they should be. */
export function staleness(files: Map<string, string>, assets: string = ASSETS): { stale: string[]; orphans: string[] } {
  const orphans = existsSync(assets)
    ? readdirSync(assets).map((f) => join(assets, f)).filter((p) => !files.has(p))
    : [];
  const stale = [...files].filter(([p, s]) => !existsSync(p) || readFileSync(p, "utf-8") !== s).map(([p]) => p);
  return { stale, orphans };
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  // A checkout that keeps no work plan, by determination, has no instances to
  // report on: not applicable, as `sweep:mark:check` says for its marks. It
  // writes and deletes nothing — the committed report belongs to a checkout
  // that has the instances. An UNREACHABLE graph is still refused below.
  const absent = workflowStateAbsent(REPO);
  if (absent !== undefined) {
    console.log(`✓ prov-qaqc: not applicable — ${absent}`);
    process.exit(0);
  }
  let r: Report;
  try {
    r = await buildReport();
  } catch (e) {
    console.error(`✗ prov-qaqc: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
  if (r.invalid.length) {
    console.error(`✗ ${r.invalid.length} prov:Activity record(s) do not validate:`);
    for (const f of r.invalid) console.error(`  ${f}`);
    process.exit(1);
  }
  const t = totals(r);
  const summary = `${r.instances.size} instance(s), ${t.checked} step(s), ${t.activities} activit${t.activities === 1 ? "y" : "ies"}; findings (advisory): ${FINDING_KINDS.filter((k) => !SHOWN_WHEN_PRESENT.has(k) || t.byKind[k] > 0).map((k) => `${k} ${t.byKind[k]}`).join(", ")}`;
  const files = outputs(r);
  const onBranch = instancesOnStateBranch();
  if (check) {
    const { stale, orphans } = judged(files, onBranch);
    if (stale.length || orphans.length) {
      for (const p of stale) console.error(`✗ stale: ${relative(REPO, p)}`);
      for (const p of orphans) console.error(`✗ orphan: ${relative(REPO, p)}`);
      console.error("Run `bun run cat prov:qaqc` and commit the result.");
      process.exit(1);
    }
    console.log(
      onBranch === undefined
        ? `✓ PROV-O QA/QC report current: ${summary}`
        : `✓ PROV-O QA/QC report valid, and every committed output current: ${summary} (the instances are on the state branch mounted at ${onBranch}: an output not committed is derived at check time)`,
    );
    process.exit(0);
  }
  const { orphans } = staleness(files);
  for (const [p, s] of files) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, s);
  }
  for (const p of orphans) rmSync(p);
  console.log(`Wrote ${relative(REPO, PAGE)} and ${r.instances.size} PROV log(s): ${summary}`);
}
