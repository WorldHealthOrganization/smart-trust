#!/usr/bin/env bun
/**
 * Audit the knowledge graph — processes, decisions, roles, skills — and write
 * one QA sidecar per audited node.
 *
 * The model it checks is one sentence: **an actor performs a task in a process
 * as a role, using that role's skills.** Every join in that sentence is a place
 * two independently-edited files can stop agreeing; `check-workflow-refs.ts`
 * checks skill refs, and this walks the rest:
 *
 *   activity ──names──▶ skill          skill-ref-resolves
 *   activity ──sits in─▶ lane          activity-in-lane
 *   lane     ──is─────▶ role           lane-binds-role · role-ref-resolves
 *   role     ──carries▶ skill          role-carries-activity-skill · role-skills-resolve
 *   role     ──is-a───▶ role           role-inherits-resolves
 *   actor    ──takes on▶ role          role-has-actor
 *   gateway  ──computes▶ decision      decision-ref-resolves · decision-outcomes-used
 *
 * ## Sidecars rather than a console report
 *
 * The sidecars are committed, so the diff says exactly which findings a change
 * introduced, separating a new defect from inherited debt. Same file shape as
 * the block sweep's `*.qa.json` and the script sweep's `*.script-qa.json`;
 * schema in `schemas/sdlc/kg-qa.ts`.
 *
 * ## Gate
 *
 *   bun run cat kg:audit            write sidecars, print a summary, exit 0
 *   bun run cat kg:audit --check    fail on a `critical` finding, or on a stale sidecar
 *   bun run cat kg:audit --strict   ...and on `major` too
 *   bun run cat kg:audit --json     the full report set, for a tool
 *   bun run cat kg:audit --instance ./bootstrap
 *                               audit ANOTHER declared layer from its own
 *                               root, writing its sidecars under its own
 *                               results directory
 *
 * A diagram that will not load records `unknown` against every criterion,
 * including the critical ones, so it fails `--check`. `unknown` is never
 * written as a pass.
 *
 * @module scripts/kg-audit
 * @covers processes, scenarios, skills, tools, cat-harness, attestations, test-plan — the graph typologies
 *   `KG_SUBJECT_GRAPH_TYPOLOGIES` maps its seven subject kinds onto, plus the
 *   attestation store it reads and `--check`s, plus the declared `test-plan`
 *   directories `testPlanCriteria` reads and judges — which audit:coverage
 *   otherwise reports as typed-only
 */

import { createHash } from "node:crypto";
import { parse as parseYaml } from "yaml";
import { defaultGraphTypologies } from "../schemas/kg/graph-typology-registry.js";
import { contractFile, contractRefProblem, skillContracts } from "./skill-contracts.js";
import { checkTestRuns, testRunFiles, type RunFinding } from "./test-run-conformance.js";
import { BUILDING_ENV } from "./qa-working-copy.ts";
import { auditCertifications, auditTestGherkin, auditTestPlans, jsonFilesUnder, auditTestPlanExitCriteria } from "./test-plan-audit.js";
import { processArrowFindings, schemaArrowFindings } from "./arrow-direction.js";
import { contentCodeFindings, contentInstanceCode } from "./content-holds-code.js";
import { orphanSubjectResolves } from "./orphan-detector.js";
import { evaluateActorFactConsumers } from "./actor-facts.js";
import { evaluateTraceabilityAudit } from "./trace-work.ts";
import { auditLakeTargetLeanResolution } from "./check-lake-targets.js";
import { classifyName, diagramProse, generalDeclarationProse, namedFiles } from "./prose-names.js";
import { readSchemaGraph } from "./schema-graph.js";
import { checkTools, unresolvedPaths } from "./check-tools.js";
import { deriveAlternatives } from "../schemas/tools/tool.js";
import { tools, toolsOf } from "../tools/discover.js";
import { kgDirectories, kgRoots, ownKgRoots, workflowFiles, corpusScopeFor } from "./known-skills.js";
import { baseDocsDir, docsLayers } from "./compose-docs.js";
import { PAIR_CRITERION, discoverPairs, evaluatePairsFrom, readAttestations, type PairAttestation } from "./prose-code-pairs.js";
import { VOICE_REVIEW_CRITERION, evaluateVoiceReviewsFrom, readVoiceReviews, skillVoices, type VoiceReview } from "./skill-voice-review.js";
import {
  ATTESTATIONS_SUFFIX,
  attestationPathFor,
  attestationsHomeFor,
  CERTIFICATION_FAMILY,
  KG_QA_SIDECAR_SUFFIX,
  priorKgJudgements,
  QA_ATTESTATIONS_SCHEMA,
  readAttestationFile,
  serialiseAttestations,
  type KgAttestations,
} from "../schemas/sdlc/qa-attestations.js";
import { claimsEntry, judgePair, rootScripts } from "./pair-claims.js";
import { auditFolioBlocks } from "./block-reference-resolver.js";
// `Dirent` for the orphan-sidecar sweep (bean `3jj9`), which walks the
// results tree with `withFileTypes` to tell a directory from a file.
import { writePathOf } from "./lib/layer-output.ts";
import { withPriorAdversarialReviews } from "./lib/kg-qa-carry.ts";
import { judgeSkillRef, switchedOffSkillHomes } from "./lib/switched-off-skills.ts";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, writeSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { corpusPredicate } from "../schemas/sdlc/git-corpus.ts";

import {
  KG_QA_SCHEMA,
  KG_QA_DIRNAME,
  kgQaSidecarPath,
  partitionBySubjectOwner,
  sweepOrphans,
  type OrphanSidecar,
  KG_QA_MANIFEST_SCHEMA,
  KG_QA_MANIFEST_PATH,
  KG_CRITERIA,
  KG_CRITERIA_BY_ID,
  criteriaFor,
  tally,
  worstSeverity,
  gradedKgFindings,
  mirroredSubjectDir,
  type KgCriterionEntry,
  type KgFinding,
  type KgQaManifest,
  type KgQaReport,
  type KgResult,
  type KgSeverity,
  type KgSubjectKind,
} from "../schemas/sdlc/kg-qa.js";
import { leftOutByMount } from "../schemas/kg/remote-mount.js";
import {
  laneBinding,
  readRoleGraph,
  readActors,
  readPermissions,
  resolveRoleSkills,
  roleForLane,
  findRole,
  fulfilmentKindsForBpmnType,
  type RoleGraph,
  type LoadedActor,
} from "../schemas/process/role-graph.js";
import { ANYONE, ODRL_ACTIONS, policyGrants, readPolicies } from "../schemas/content/odrl.js";
import { againstOrUsage, judgeSidecarTree, judgeUsage, qaStorageOf } from "./qa-results.ts";
import { readQaTree } from "./qa-store.ts";
import { globalTaskSharedFindings } from "./lib/global-task-criteria.ts";
import { loadProcessModel, loadGlobalTasks, isGlobalTasksFile, isActivity, isDecision, indistinctBranches, type ProcessModel } from "../src/workflow/process-model.js";
import { reachability } from "../src/workflow/reachability.js";
import { diagramQuality, readLayout, LAYOUT_CRITERIA } from "../src/workflow/diagram-quality.js";
import { diagramFit, FIT_CRITERIA } from "../src/workflow/diagram-fit.js";
import { raciBreaches, raciRowsOf, type RaciBreachKind } from "./raci-chart.js";
import { loadDecisionTable, possibleOutcomes } from "../src/workflow/decision-table.js";
import {
  consultedSkills,
  unpublishedSkills,
  isSkillMd,
  knownSkills,
  remotePackageDeclarations,
  remotePackageSkills,
} from "./known-skills.js";
import { LOCAL_PACKAGES } from "./skill-packages.js";
import { findInstanceRoot, repoRootFor, DECLARATION_SUFFIX, ownDirectoryById, resolveDirectories, instanceDirectoriesForGraph, layerRootsIn, readDeclaration, kgQaHomeFor} from "../schemas/kg/cat-harness.js";
import { toolDownstreamEntry, undeclaredDownstreamEntry } from "./downstream-runs.ts";
import { VERIFIERS } from "./publish-verify.ts";
import { checkoutRootFor, orderedDependencies } from "../schemas/kg/harness-config.js";
import { CONVENTION_GROUP } from "../schemas/process/convention.js";
import { USER_STORIES_FILENAME, danglingStoryRoles, readUserStories, type UserStoryGraph } from "../schemas/process/user-story.js";
import { actorsDir, capabilitiesDir } from "../schemas/process/role-graph.ts";
import { conventionsDir, skillDefinitionDirs } from "../schemas/kg/skill-definitions-dir.ts";
import {
  checkoutActors,
  checkoutPolicies,
  checkoutRoleGraph,
  neededActors,
  neededPolicies,
} from "../schemas/process/scenario-overlay.js";
import { HARNESS_ROOT, REPO_ROOT as WORKSPACE_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import { computedWhere, computeTestRuns } from "./test-run-compute.ts";
import { legacyBindingFindings, mechanicalRoleUntested, skillsOutsideLaneRole } from "./lib/lane-role-criteria.ts";
import { skillEdgeIndex } from "./lib/skill-edges.ts";
import { type ActorScope, declaredCapabilityIds, unresolvedActorCapabilities } from "./lib/actor-capabilities.ts";

const ENGINE_VERSION = "1";

/**
 * Does anybody in this role read prose?
 *
 * Only a reader needs a persona, a voice and use cases. Two kinds do not: a
 * `system` is a pipeline or a store that consumes files, not pages; an
 * `external` participant is outside this layer entirely. A role only they
 * play is mechanical (`isMechanicalRole`), and its skills are a contract to be
 * tested, not prose to be read — `mechanical-role-untested` asks what does
 * apply. (An `actedUpon` flag made the same exemption by hand until it was
 * retired, owner, 2026-10-16.)
 *
 * Scoping this way rather than asking every role is what keeps the finding
 * actionable. "The IG publisher service has no persona" is a finding nobody
 * can act on, and a check that produces those is a check somebody switches
 * off.
 */
function readsProse(r: { actorKinds: string[] }): boolean {
  // ANY, not every. A role a person may take on has prose read in it, even
  // where a mechanical actor may also fill the lane — the question is whether
  // the instructions can reach a reader, and one reader is enough.
  return r.actorKinds.some((k) => k === "person" || k === "agent");
}

/**
 * `--instance ROOT`, or undefined.
 *
 * Spelled as `kg-locale-export.ts` spells it, which is the established
 * precedent in this repo (`kg:locale:bootstrap` is
 * `--instance ./bootstrap`). A second spelling for the same idea is a second
 * thing to remember.
 *
 * Not tested by import: this module runs its whole audit at module scope and
 * writes sidecars, so importing it to reach one pure function would perform an
 * audit as a side effect — the unguarded-entry-point defect
 * `declared-directory-resolves.test.ts` guards. It is asserted end-to-end by
 * spawning the script instead.
 */
function instanceArg(args: readonly string[]): string | undefined {
  const i = args.indexOf("--instance");
  return i >= 0 ? args[i + 1] : undefined;
}

/**
 * The AUDITOR's own layer. Never the layer under audit.
 *
 * Split from {@link root} on 2026-09-26 (bean `bjzs`) because one constant was
 * answering two questions, and exactly one line needed the difference: the
 * auditor hash below read `join(root, "scripts", "kg-audit.ts")`, which for
 * `--instance ./bootstrap` resolves to `bootstrap/scripts/kg-audit.ts` — a file
 * that does not exist, so the run would have thrown before auditing anything.
 * The hash is a fact about the PROGRAM, so it resolves against the program.
 */
const AUDITOR_ROOT = resolve(HARNESS_ROOT);

/**
 * The layer under audit — `--instance ROOT`, defaulting to the auditor's own.
 *
 * ## Why one assignment rather than a thread through 78 call sites
 *
 * Everything this script reads derives from here: the nine `*_DIR` constants
 * below, `knownSkills(root)`, and `sidecarPath`'s
 * `dirname(join(root, subject.path))`. So pointing this one constant at another
 * declared layer moves the whole audit, its subject discovery AND its output,
 * with no change at any other site. Bean `bjzs` estimated this as *"`root` × 76
 * across 2344 lines plus 9 derived `*_DIR` constants"* and banked it as
 * expensive; measured, the cost is this assignment plus the auditor-hash split
 * above, because nothing needs a DIFFERENT root part-way through a run.
 *
 * ## Why the sidecars land correctly for free
 *
 * `kgQaSidecarPath(repoRoot, subjectDir, stem)` composes with `relative` and
 * handles an escaping subject explicitly — `escaped = rel.startsWith("..")`. So
 * bean `chq5`'s concern, that a `../` subject escapes the results tree, is
 * answered inside that helper rather than needing an answer here, and each
 * layer's findings land under its own results directory: a layer's audit
 * is an artefact OF that layer, the same way its glossary is.
 *
 * ## What this deliberately does NOT do
 *
 * It does not declare a nested layer's directories at the root. That is the
 * wrong fix established twice (`pve3`, `sa8y`) and guarded by
 * `instance-graph-isolation.test.ts` after a live 2026-09-19 leak in which
 * `findBpmnDirs` walked the filesystem and one export carried 88 references to
 * another layer's process. Per-instance means a separate RUN, not a wider
 * walk.
 *
 * Parsed here rather than beside `--check` at the bottom because the nine
 * derived constants are evaluated at module scope, immediately below.
 */
const root = resolve(instanceArg(process.argv.slice(2)) ?? AUDITOR_ROOT);

/**
 * THIS layer's own directory with `id`, or the convention if it declares none.
 *
 * Not {@link instanceDirectoryForGraph}: that asks by KIND, and a path-less
 * subject belongs to the layer's OWN graph, which is a question only the id
 * answers: *"a by-ID lookup through `resolveDirectories` is the answer when you
 * want a particular one."*
 *
 * THE CONCRETE WITNESS IS GONE, AND THAT IS WHY THIS PARAGRAPH IS REWRITTEN
 * RATHER THAN LEFT. Until 2026-09-22 this said the layer declares TWO
 * directories holding `processes` — its own and CRDM's
 * `methodologies/crdm/processes/` — so a by-kind lookup throws. CRDM's
 * diagrams moved into `processes/` that day (the owner's "dont bury sub-graph
 * assets"), the second declaration was dropped, and exactly one directory
 * holds `processes` now. So the by-kind lookup would no longer throw here.
 *
 * The id lookup stays, because the reason was never the count: a by-kind
 * lookup that happens to work while one directory exists is a call that starts
 * throwing the day a second is declared, and it would be asking the wrong
 * question even while it worked. A comment justifying it by a witness that no
 * longer exists is worse than none, which is the only reason this is five
 * lines instead of one.
 */
// `ownDirectoryById` moved to `schemas/kg/cat-harness.ts` (2026-09-30) when
// `pipeline/translation-index.ts` became its second caller. The
// reasoning for the BY-ID lookup travelled with it.

// declared-path-literal: the convention fallback, at the call site — a
// layer that declares no `processes` directory still needs a sidecar home
// for a path-less subject, and the convention is where one would look.
const WORKFLOW_DIR = ownDirectoryById(root, "processes", "processes");
// declared-path-literal: the convention fallback, at the call site. Same
// reasoning as `WORKFLOW_DIR` — the role graph moved out of the skills tree
// on 2026-09-21 and a path-less subject needs a sidecar home.
const SCENARIO_DIR = ownDirectoryById(root, "scenarios", "scenarios");
// declared-path-literal: the convention fallback, at the call site, as for
// `SCENARIO_DIR`. The ODRL policies (issue #1180) are their own graph typology.
const POLICY_DIR = ownDirectoryById(root, "policies", "policies");
const FOLIO_DIR = ownDirectoryById(root, "folio", "folio");
const DECISION_DIR = join(WORKFLOW_DIR, "decisions");
const KG_ROOT = join(root, "skills");
// The actor registry's declared home (bean rqao). kg-audit runs over ANY
// layer, fixtures included, where the platform may declare no `scenarios`
// graph: that is "no actor registry here", which `readActors` answers with an
// empty list and the actor criteria then report on. It was the same before the
// move, when the probed `.claude/skills/actors` simply did not exist.
/**
 * The CHECKOUT the audited layer is staged in — where `package.json`,
 * `.claude/`, the actor registry and the tracked-file list live, and what every
 * repo-relative path in a sidecar is relative to (bean `pgzn`).
 *
 * NOT `REPO_ROOT`, which is `dirname`. That is right for every layer
 * nested one level under the repository and wrong for the one declared AT it:
 * for `--instance .` it climbed out of the checkout, so `rootScripts` threw
 * `ENOENT …/package.json` before anything was audited — and the other call
 * sites that asked the same question through `repoRootFor` would have read a
 * directory above the checkout without saying so. `checkoutRootFor` agrees
 * with `dirname` for every nested layer and is the root itself for the
 * root layer; `siblingScopeFor`'s docblock records the same trap.
 */
const REPO_ROOT = checkoutRootFor(root);
const ACTOR_DIR = actorsDir(REPO_ROOT) ?? "";
// Declared home inside `scenarios` (bean rqao); "" when there is none, as for ACTOR_DIR.
const CAPABILITY_DIR = capabilitiesDir(REPO_ROOT) ?? "";
const REQUIREMENT_DIR = join(KG_ROOT, "requirements");
// declared-path-literal: the convention fallback, at the call site. Same
// reasoning as `WORKFLOW_DIR`. A Tool node carries NO path of its own — the
// nodes are authored in TypeScript, several to a module, so there is no
// per-node file to sit a sidecar beside and `sidecarPath` falls back to here.
const TOOLS_DIR = ownDirectoryById(root, "tools", "tools");
const SCHEMAS_DIR = ownDirectoryById(root, "schemas", "schemas");

const sha256 = (s: string) => `sha256:${createHash("sha256").update(s).digest("hex")}`;

/**
 * A criterion's outcome, built from its findings.
 *
 * One helper rather than a ternary at fourteen call sites, because the rule
 * "no findings means pass" has one exception — a criterion that did not apply
 * — and writing that by hand each time is how one of them ends up reporting a
 * clean pass over something it never looked at.
 */
function entry(findings: KgFinding[], applicable = true): KgCriterionEntry {
  if (!applicable) return { result: "n/a", findings: [] };
  return { result: findings.length ? "fail" : "pass", findings };
}

/** Every criterion for this kind recorded as `unknown`, with one reason. */
function allUnknown(kind: KgSubjectKind, reason: string): Record<string, KgCriterionEntry> {
  const out: Record<string, KgCriterionEntry> = {};
  for (const c of criteriaFor(kind)) {
    out[c.id] = { result: "unknown", findings: [{ where: "—", detail: reason }] };
  }
  return out;
}

/**
 * Is this run scoped to a layer other than the one the auditor lives in?
 *
 * The question a `repo`-scoped criterion cannot answer. Compared as resolved
 * paths rather than on the presence of `--instance`, so
 * `--instance ./cat-harness` from the repository root behaves as the default run
 * does instead of silently suppressing five criteria.
 */
const INSTANCE_RUN = root !== AUDITOR_ROOT;

/**
 * Where this run's verdicts go: the layer's own `qa` directory, or — for a
 * layer that declares none, such as bootstrap — the auditor's, under the
 * layer's stub. `kgQaHomeFor` says why; everything below writes, reads and
 * sweeps through these two paths and composes no other.
 */
const QA_HOME = kgQaHomeFor(root, INSTANCE_RUN ? AUDITOR_ROOT : undefined);
/** The layer's `kg-qa/` tree as the layer lays it out: what its declarations and the stored-directory test name. */
const KG_QA_LOGICAL = join(QA_HOME.root, "kg-qa");
/**
 * Where this run writes and reads the tree: the logical one for a local
 * layer, its layer output root (`build/layers/<instance>/…`) for a mounted
 * one, so the audit never writes into a mount (bean `cat-tools-sm8r`, item
 * 4). Every sidecar, relocation and orphan sweep below is computed from it,
 * so they move together.
 */
const KG_QA_TREE = writePathOf(KG_QA_LOGICAL);
/**
 * A sidecar's path as the layer lays it out: the key its `qa-reports`
 * baseline is stored under, and the name a finding prints. The judge compares
 * by it, so a finding computed at the layer output root is not read as new.
 */
function logicalSidecar(p: string): string {
  return KG_QA_TREE === KG_QA_LOGICAL ? p : join(KG_QA_LOGICAL, relative(KG_QA_TREE, p));
}

/**
 * Where this run's JUDGEMENTS live — pair attestations and voice reviews —
 * apart from the derived sidecars above (bean `2gst`, owner ruling D2 (a)).
 * The same own / hosted / convention answer as `QA_HOME`, from the
 * `attestations` directory; the tree under it mirrors `KG_QA_TREE` exactly.
 * See `schemas/sdlc/qa-attestations.ts`.
 */
const ATT_HOME = attestationsHomeFor(root, INSTANCE_RUN ? AUDITOR_ROOT : undefined);
const KG_ATT_TREE = join(ATT_HOME.root, "kg-qa");
/** The declared directory whose absence makes every read `unknown` (never a re-baseline). */
const ATT_STORE = ATT_HOME.storeRoot;
/**
 * The attestation store is COMMITTED content (ruling D2 (a)). In a layer this
 * checkout MOUNTS it is the pinned bytes, and nothing here may rewrite it
 * (bean `cat-tools-sm8r`, item 4): a write that would change it is reported,
 * and the layer's own repository makes it.
 */
const ATT_IN_MOUNT = writePathOf(ATT_STORE) !== ATT_STORE;
/** Attestation files a write run would have rewritten in a mounted layer: reported, never written. */
const attLeftInMount: string[] = [];
/**
 * Is the derived kg-qa tree STORED on `qa-reports` (bean `oqe3`)? Then its
 * working copy is a measurement of the last run, not a record: a stale or
 * orphaned sidecar there is advisory in judge mode. Unstored, it is still the
 * committed record and both are findings, as they were.
 */
const derivedStored = qaStorageOf(KG_QA_LOGICAL) !== undefined;


/**
 * How many criteria this run did not evaluate because they are `repo`-scoped.
 *
 * Counted, because the whole risk of a scope field is that a wrong `repo` reads
 * as a clean `n/a` forever. The count is printed in the summary, so suppression
 * is a number a reader can challenge rather than an absence nobody sees.
 */
let scopeSuppressed = 0;

/**
 * Replace a `repo`-scoped criterion's verdict with `n/a` in an instance run,
 * keeping WHY in the findings.
 *
 * `n/a` rather than a fifth `KgResult`: this is the same idea as `applies` on a
 * different axis — not-applicable-here, not could-not-determine — and adding a
 * state would change every consumer of the sidecar for a distinction the two
 * existing ones already carry.
 *
 * **But not a silent `n/a`.** An ordinary `n/a` has empty findings; this one
 * carries a detail naming the scope and the basis, so a reader walking the
 * sidecar can tell "this criterion does not apply to this kind of node" from
 * "this criterion was withheld from this instance, and here is the argument".
 * Bean `bjzs`: the owner chose classifying all 68 over declaring only the one
 * measured to misfire, and the cost of that choice is a wrong `repo` suppressing
 * a real finding — which this makes loud rather than preventing.
 */
function scoped(criteria: Record<string, KgCriterionEntry>): Record<string, KgCriterionEntry> {
  if (!INSTANCE_RUN) return criteria;
  const out: Record<string, KgCriterionEntry> = {};
  for (const [id, e] of Object.entries(criteria)) {
    const def = KG_CRITERIA_BY_ID[id];
    if (def?.scope !== "repo") {
      out[id] = e;
      continue;
    }
    scopeSuppressed += 1;
    out[id] = {
      result: "n/a",
      findings: [
        {
          where: "—",
          detail:
            `not evaluated: \`${id}\` is \`repo\`-scoped and this run is scoped to ` +
            `${relative(repoRootFor(AUDITOR_ROOT), root) || "."}. ${def.scopeBasis ?? ""}`.trim(),
        },
      ],
    };
  }
  return out;
}

function report(
  kind: KgSubjectKind,
  id: string,
  path: string | null,
  sourceHash: string | null,
  criteria: Record<string, KgCriterionEntry>,
): KgQaReport {
  // Scoped BEFORE the tally, so the totals a consumer reads describe what this
  // run actually judged rather than what it would have judged at the root.
  const scopedCriteria = scoped(criteria);
  return {
    $schema: KG_QA_SCHEMA,
    subject: { kind, id, path },
    source_hash: sourceHash,
    criteria: scopedCriteria,
    totals: tally(scopedCriteria),
  };
}

// ── Corpus ──────────────────────────────────────────────────────

interface LoadedProcess {
  /** ABSOLUTE path. Was a bare basename joined to one WORKFLOW_DIR, which
   *  stopped being a single directory once a layer can declare several. */
  file: string;
  model?: ProcessModel;
  error?: string;
}

/** The shared global-tasks files `loadProcesses` passed by, for `global-task-shared`. */
const globalTaskFiles: string[] = [];

async function loadProcesses(): Promise<LoadedProcess[]> {
  // Every declared knowledge-graph directory, via the same helper the other
  // consumers use, so none of them can disagree about where diagrams live.
  const files = workflowFiles(root, corpusScopeFor(root)).filter((f) => f.endsWith(".bpmn"));
  const out: LoadedProcess[] = [];
  for (const file of files) {
    // A layer's shared global-tasks file holds no process (owner, 2026-10-20,
    // "a1"); its tasks are audited through the calls to them, and
    // `global-task-shared` asks whether each is actually shared.
    if (isGlobalTasksFile(readFileSync(file, "utf-8"))) {
      globalTaskFiles.push(file);
      continue;
    }
    try {
      out.push({ file, model: await loadProcessModel(file) });
    } catch (e) {
      out.push({ file, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

interface RepoProcess {
  instance: string;
  file: string;
}

function loadRepoProcesses(repoRoot: string): Map<string, RepoProcess> {
  const map = new Map<string, RepoProcess>();
  for (const inst of layerRootsIn(repoRoot)) {
    const instName = readDeclaration(inst)?.name ?? basename(inst);
    let files: string[] = [];
    try {
      files = workflowFiles(inst, corpusScopeFor(inst)).filter((f) => f.endsWith(".bpmn"));
    } catch {
      continue;
    }
    for (const file of files) {
      try {
        const text = readFileSync(file, "utf-8");
        const re = /<(?:\w+:)?process\s+[^>]*\bid=["']([^"']+)["']/g;
        let match: RegExpExecArray | null;
        while ((match = re.exec(text)) !== null) {
          map.set(match[1], { instance: instName, file });
        }
      } catch {
        // Unreadable file
      }
    }
  }
  return map;
}

// ── Documentation surface ───────────────────────────────────────

/**
 * What a reader can reach: the base docs layer's rendered diagrams, and the
 * text of every page in every layer, read once per run.
 *
 * `undefined` when no docs layer is declared, which `process-diagram-published`
 * records as `unknown` — the third state. Treating "could not look" as "shown
 * nowhere" would fail every diagram in a layer that publishes elsewhere;
 * treating it as "shown" would be the clean run over nothing (`dh4f`).
 */
interface DocsSurface {
  /** Absolute directory `render:bpmn` writes SVGs into. */
  svgDir: string;
  /** Every page's text, concatenated — searched for `workflows/<stem>.svg`. */
  pages: string;
}

function docsSurface(): DocsSurface | undefined {
  let layers;
  try {
    layers = docsLayers(resolve(root, "..")).layers;
  } catch {
    return undefined;
  }
  // The PAGES layer, not merely the first: since slice 1 of the semantic
  // subgraphs the site chrome is declared first (`baseDocsDir`).
  let baseDir: string | undefined;
  try {
    baseDir = baseDocsDir(resolve(root, ".."));
  } catch {
    baseDir = undefined;
  }
  const base = layers.find((l) => resolve(l.dir) === (baseDir === undefined ? undefined : resolve(baseDir)));
  if (!base) return undefined;
  const texts: string[] = [];

  // ASK GIT what the page corpus is, for anything inside this repository.
  //
  // This walk used to exclude `_site`, `node_modules` and `vendor` by name, and
  // a name list cannot be complete. Measured 2026-09-26, and it cost a red CI
  // job on a green local tree (bean `xd1g`, the shape `rsi6` and `kg-detangle`
  // already paid for): this container held SIX gitignored `.md`/`.html` files a
  // fresh checkout does not — five `_kg/**/index.html` and a
  // `.pytest_cache/README.md` — none of them matching any excluded name. Their
  // text entered `pages`, so every criterion that asks "is this mentioned on a
  // page?" answered differently here than in CI, and `kg:audit:check` was green
  // locally and red on the runner FOR THE SAME COMMIT.
  //
  // A path is dropped only when it is under the repository AND git does not
  // list it, so the two cases stay distinct: a layer in a SIBLING checkout
  // (`docsLayers` may return one) is outside this corpus and cannot be judged
  // by it, and is therefore kept rather than silently dropped. `undefined` from
  // `gitCorpus` means git could not answer at all, which keeps every file for
  // the same reason — an unanswerable question is not an empty answer.
  const inCorpus = corpusPredicate(resolve(root, ".."));

  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      // input-site: inert #768fdcb7 — names a build-output directory only to leave it out of a walk
      if (e.name.startsWith("_site") || e.name === "node_modules" || e.name === "vendor") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(md|html)$/.test(e.name) && inCorpus(resolve(p))) texts.push(readFileSync(p, "utf-8"));
    }
  };
  for (const l of layers) walk(l.dir);
  return { svgDir: join(base.dir, "assets", "img", "workflows"), pages: texts.join("\n") };
}

// ── Per-process criteria ────────────────────────────────────────

async function auditProcess(
  p: LoadedProcess,
  graph: RoleGraph | undefined,
  skills: Set<string>,
  processIds: Set<string>,
  /** Basenames of every loadable diagram — a skill of the same name OWNS that process. */
  processStems: Set<string> = new Set(),
  docs?: DocsSurface,
  repoProcesses?: Map<string, RepoProcess>,
): Promise<KgQaReport> {
  const rel = relative(root, p.file);
  const hash = sha256(readFileSync(p.file, "utf-8"));

  if (!p.model) {
    return report("process", basename(p.file, ".bpmn"), rel, hash, allUnknown("process", `the diagram would not load: ${p.error}`));
  }
  const m = p.model;
  const activities = [...m.nodes.values()].filter(isActivity);

  const danglingSkill: KgFinding[] = [];
  const noSkill: KgFinding[] = [];
  const noLane: KgFinding[] = [];
  const skillNotCarried: KgFinding[] = [];
  const danglingCall: KgFinding[] = [];
  const externalCall: KgFinding[] = [];
  const undocumented: KgFinding[] = [];
  const calls = activities.filter((n) => n.calledElement !== undefined);

  // Lane ids whose role PERFORMS but by judgement — a stakeholder signing off.
  // Somebody really does the step; no instruction body can produce the answer
  // for them.
  const judgementLanes = new Set(
    graph
      ? m.lanes.filter((l) => roleForLane(graph, l.name, l.roleRef)?.judgementOnly === true).map((l) => l.id)
      : [],
  );
  /** Refs no declared layering can settle — `unknown`, kept apart from a failure. */
  const unjudgeableSkill: KgFinding[] = [];
  const judgementNode = (n: { laneId?: string }): boolean =>
    n.laneId !== undefined && judgementLanes.has(n.laneId);
  for (const n of activities) {
    for (const ref of n.skills) {
      if (resolvableSkills.has(ref)) continue;
      if (refUnjudgeable(ref)) {
        // Third state, not a pass and not a failure: the ref is absent from
        // everything reachable, but what IS reachable was never declared.
        unjudgeableSkill.push({
          where: n.id,
          detail:
            `names skill "${ref}", which this instance does not hold — and whether a dependency holds it ` +
            `cannot be decided, because this instance declares no \`needs\`. Declare the layering in ` +
            `its \`<name>.json\` and this criterion becomes answerable.`,
        });
        continue;
      }
      danglingSkill.push({
        where: n.id,
        detail: `names skill "${ref}", which resolves to no skill in this instance or anything it \`needs\`.`,
      });
    }
    // A call activity is implemented by the process it calls, not by a skill.
    // Demanding a `<bootstrap.processes:skill ref>` of it asks the diagram to name a second,
    // redundant implementation — and the one that matters is checked by
    // `call-activity-resolves` below, so the exemption leaves no gap.
    //
    // There was a third exemption, the `actedUpon` lane — a store "written to,
    // never acts". Retired, owner 2026-10-16: a role a machine plays is a real
    // role whose skills are its contract, so its tasks name those skills.
    //
    // Two declared exemptions, and each one is READ from a declaration
    // rather than inferred: a `judgementOnly` lane (somebody performs it, but
    // no procedure yields the answer), and `<cat-harness.processes:no-skill
    // reason>` on the activity itself. Because
    // every legitimate case now SAYS SO, what is left is a real gap — which is
    // what lets this criterion gate instead of staying advisory.
    if (
      n.skills.length === 0 &&
      n.calledElement === undefined &&
      !judgementNode(n) &&
      n.noSkillReason === undefined
    ) {
      noSkill.push({
        where: n.id,
        detail:
          `"${n.name}" names no skill. Give it <bootstrap.processes:skill ref="…"/>, or, if none could exist, ` +
          `declare <cat-harness.processes:no-skill reason="…"/> saying why.`,
      });
    }
    if (n.calledElement !== undefined) {
      if (processIds.has(n.calledElement)) {
        // Resolves locally within this layer.
      } else if (repoProcesses?.has(n.calledElement)) {
        const hosted = repoProcesses.get(n.calledElement)!;
        externalCall.push({
          where: n.id,
          detail: `calls "${n.calledElement}", hosted by instance "${hosted.instance}".`,
        });
      } else {
        danglingCall.push({
          where: n.id,
          detail:
            `calls "${n.calledElement}", which is the id of no process this instance or any other instance in the ` +
            `repository can load.`,
        });
      }
    }
    if (!n.lane) noLane.push({ where: n.id, detail: `"${n.name}" sits in no lane, so no role — and therefore no actor — performs it.` });
    if (!n.documentation) {
      undocumented.push({ where: n.id, detail: `"${n.name}" carries no <bpmn:documentation>, so its page shows a name and nothing more.` });
    }
  }

  // A skill that owns a same-named process, named by exactly ONE plain step
  // here. Several steps naming it are using its know-how, not calling it —
  // see the criterion's note in `schemas/sdlc/kg-qa.ts`.
  const stem = basename(p.file, ".bpmn");
  const namers = new Map<string, typeof activities>();
  for (const n of activities) {
    for (const ref of new Set(n.skills)) {
      if (ref === stem || !processStems.has(ref)) continue;
      namers.set(ref, [...(namers.get(ref) ?? []), n]);
    }
  }
  const shouldCall: KgFinding[] = [];
  for (const [ref, ns] of namers) {
    // A declared `<cat-harness.processes:no-call reason>` is the recorded judgement that this
    // step uses the skill without being its process — `n/a` for that step.
    if (ns.length !== 1 || ns[0].calledElement !== undefined || ns[0].noCallReason !== undefined) continue;
    shouldCall.push({
      where: ns[0].id,
      detail:
        `"${ns[0].name}" names skill "${ref}", which owns ${ref}.bpmn, but is a plain task. Make it a ` +
        `<bpmn:callActivity calledElement="…"> so the diagram descends into that process, or declare ` +
        `<cat-harness.processes:no-call reason="…"/> saying why it only uses the skill.`,
    });
  }

  // Published: an SVG exists AND some page embeds it.
  let published: KgCriterionEntry;
  if (!docs) {
    published = { result: "unknown", findings: [{ where: "—", detail: "no docs layer is declared, so no page could be searched." }] };
  } else if (!existsSync(join(docs.svgDir, `${stem}.svg`))) {
    published = entry([{ where: m.id, detail: `no rendered diagram at ${stem}.svg — run \`bun run cat render:bpmn\`.` }]);
  } else {
    published = entry(
      docs.pages.includes(`workflows/${stem}.svg`)
        ? []
        : [{ where: m.id, detail: `${stem}.svg is rendered but no docs page shows it — run \`bun run cat processes:viz\`.` }],
    );
  }

  // Lanes → roles.
  const danglingRoleRef: KgFinding[] = [];
  /** Role refs no declared layering can settle — `unknown`, kept from a failure. */
  const unjudgeableRoleRef: KgFinding[] = [];
  const unboundLane: KgFinding[] = [];
  /** Lanes that declared a varying performer — counted, never a finding. */
  const variablePerformer: KgFinding[] = [];
  /** ...and those that declared one alongside a `ref`, which cannot be both. */
  const contradictoryPerformer: KgFinding[] = [];
  const laneRole = new Map<string, string>(); // lane id → role id
  // Skipped entirely with no graph, rather than computed and discarded.
  //
  // The `!graph` branch below already overwrote every one of these criteria
  // with `unknown` — so this loop's verdicts were thrown away, and bean `7go7`
  // records what that cost: `laneBinding` used to accept an undefined graph
  // and answer `dangling` for all 44 ref-bearing lanes in this corpus. The
  // audit was protected from that by the overwrite; the VIEWER, which takes
  // the verdict verbatim, was not. Making the parameter required (owner's
  // ruling, 2026-09-23) turned the discard into a skip and forced the viewer
  // to have its own answer.
  // REFERENCE resolution, computed before and independently of the own graph.
  //
  // `laneBinding` below needs a `RoleGraph` and so cannot run without one —
  // but "does this ref name a declared role?" needs only the IDS, and those
  // reach down the `needs` chain. Keeping the two apart is what lets a
  // layer with no graph of its own still have its refs resolved, instead of
  // every ref in it being reported as unresolvable (a DAK base layer, 2026-09-27).
  const roleRefs = m.lanes.flatMap((l) => (l.roleRef !== undefined && !l.performerVaries ? [l] : []));
  for (const lane of roleRefs) {
    if (resolvableRoleIds.has(lane.roleRef!)) continue;
    if (layeringUndetermined) {
      unjudgeableRoleRef.push({
        where: lane.id,
        detail:
          `binds role "${lane.roleRef}", which no reachable role graph declares — and whether a dependency ` +
          `declares it cannot be decided, because this instance declares no \`needs\`.`,
      });
      continue;
    }
    danglingRoleRef.push({
      where: lane.id,
      detail: `binds role "${lane.roleRef}", which is declared in no role graph of this instance or anything it \`needs\`.`,
    });
  }

  for (const lane of m.lanes) {
    // `break` rather than a cast: it narrows `graph` for the rest of the body,
    // and skipping is what the overwrite below already meant.
    if (!graph) break;
    // One decision, in `laneBinding`, so the rule is testable without running
    // this script — which matters because the case it exists for
    // (`log-message.bpmn`'s `Actor`) is in a NESTED layer this audit does
    // not read at all. A rule reachable only through a script that never sees
    // its own subject is a rule nothing checks.
    const b = laneBinding(graph, lane);
    switch (b.kind) {
      case "bound":
        laneRole.set(lane.id, b.role.id);
        break;
      case "dangling":
        // Reported by the reference pass above, which consults the `needs`
        // closure rather than only this layer's graph. Pushing here as well
        // would double-report every genuinely dangling ref, and would
        // contradict the pass above for one that resolves in a dependency.
        break;
      case "contradictory":
        contradictoryPerformer.push({
          where: lane.id,
          detail: `lane "${lane.name ?? lane.id}" names role "${b.ref}" (partitionElementRef, or the legacy <bootstrap.processes:role ref>) AND declares variable="true". A lane that names a role has not got a varying performer; drop whichever is wrong.`,
        });
        break;
      case "variable":
        // A DECLARED answer, not an absence — bean `ug4r`. Counted so the
        // `lane-binds-role` number means "nobody got round to it" and nothing
        // else, and so a sidecar shows the declaration rather than silence.
        variablePerformer.push({
          where: lane.id,
          detail: `lane "${lane.name ?? lane.id}" declares <bootstrap.processes:role variable="true"/> — its performer varies by design, so it binds no role and that is the answer rather than a gap.`,
        });
        break;
      case "unbound":
        unboundLane.push({
          where: lane.id,
          detail: `lane "${lane.name ?? lane.id}" names no declared role. Name one with partitionElementRef="<roleId>" on the lane and a top-level <bpmn:resource id="<roleId>"/> (owner, 2026-10-16: a lane names a Role), or — if its performer genuinely varies — declare that with <bootstrap.processes:role variable="true"/>.`,
        });
        break;
    }
  }

  // Does the lane's role carry what its activities demand?
  if (graph) {
    for (const n of activities) {
      const roleId = n.laneId ? laneRole.get(n.laneId) : undefined;
      if (!roleId) continue; // already reported as an unbound lane or a laneless activity
      const carried = new Set(resolveRoleSkills(graph, roleId).map((s) => s.skill));
      for (const ref of n.skills) {
        if (!resolvableSkills.has(ref)) continue; // a dangling ref is a different finding
        if (!carried.has(ref)) {
          skillNotCarried.push({
            where: n.id,
            detail: `needs skill "${ref}", but its lane's role "${roleId}" does not carry it.`,
          });
        }
      }
    }
  }

  // Can the lane's role actually be filled by something that can perform this
  // step? The diagram's task TYPE already answers which kinds may — BPMN says a
  // userTask is done by a person and a serviceTask without one — and until now
  // nothing joined that answer to the role graph's `actorKinds`.
  //
  // An activity whose lane is unbound or absent
  // is already reported by `lane-binds-role` / `activity-in-lane`; repeating it
  // here would make one defect look like two.
  const wrongKind: KgFinding[] = [];
  let kindApplicable = 0;
  if (graph) {
    for (const n of activities) {
      const roleId = n.laneId ? laneRole.get(n.laneId) : undefined;
      if (!roleId) continue;
      const role = findRole(graph, roleId);
      if (!role) continue;
      const allowed = n.fulfilment?.kinds ?? fulfilmentKindsForBpmnType(n.type);
      if (!allowed) continue; // a bpmn:Task or call activity asserts nothing
      kindApplicable += 1;
      // INTERSECTION, non-empty. The step says which kinds may perform it and
      // the role says which may take it on; the step is fillable when some
      // kind satisfies both. Requiring every kind the role admits would fail a
      // lane the moment it was widened to include a second one, which is
      // exactly backwards.
      if (role.actorKinds.some((k) => allowed.includes(k))) continue;
      const how = n.fulfilment
        ? `<cat-harness.processes:fulfilment/> on the step allows ${allowed.join(", ")} (${n.fulfilment.reason})`
        : `a ${n.type.replace("bpmn:", "")} is performed by ${allowed.join(" or ")}`;
      wrongKind.push({
        where: n.id,
        detail:
          `"${n.name}" — ${how}, but its lane's role "${roleId}" admits only ${role.actorKinds.join(", ")}. ` +
          `Either the task type is wrong, the lane is wrong, or the step really does admit that kind — ` +
          `in which case say so with <cat-harness.processes:fulfilment kinds="…" reason="…"/>.`,
      });
    }
  }

  // DECISIONS — diverging exclusive gateways. Merges, forks and joins decide
  // nothing, so `isDecision` leaves them out; see the criteria's notes in
  // `schemas/sdlc/kg-qa.ts` for the measurement behind both.
  const decisions = [...m.nodes.values()].filter(isDecision);
  const undocumentedDecision: KgFinding[] = decisions
    .filter((n) => !n.documentation)
    .map((n) => ({
      where: n.id,
      detail:
        `"${n.name}" carries no <bpmn:documentation>, so its page shows the question and not what answers it ` +
        `— who decides, from what evidence, and what each branch commits the process to.`,
    }));
  const indistinct: KgFinding[] = decisions.flatMap((n) =>
    indistinctBranches(m, n).map((b) => ({
      where: b.flowId,
      detail:
        b.problem === "unnamed"
          ? `a branch out of "${n.name}" (${n.id}) has no name, so a reader cannot tell which answer takes it.`
          : `a branch out of "${n.name}" (${n.id}) is labelled "${b.label}", as is a sibling — the two cannot be told apart.`,
    })),
  );

  // Gateways computing their branch from a DMN table.
  const decisionRefs = [...m.nodes.values()].filter((n) => n.decisionRef);
  const danglingDecision: KgFinding[] = [];
  for (const n of decisionRefs) {
    const [file, decId] = n.decisionRef!.split("#");
    const abs = join(m.dir, file ?? "");
    if (!existsSync(abs)) {
      danglingDecision.push({ where: n.id, detail: `names decision file "${file}", which does not exist.` });
      continue;
    }
    try {
      await loadDecisionTable(abs, decId ?? "");
    } catch (e) {
      danglingDecision.push({ where: n.id, detail: `decision "${n.decisionRef}" will not load: ${e instanceof Error ? e.message : e}` });
    }
  }

  const servable = servableSkills();
  const unservable: KgFinding[] = [];
  for (const n of activities) {
    for (const ref of n.skills) {
      if (!resolvableSkills.has(ref)) continue; // a dangling ref is a different finding
      if (!servable.has(ref)) {
        unservable.push({
          where: n.id,
          detail: `names skill "${ref}", which exists but no local package serves — skill_fetch would answer "package not found".`,
        });
      }
    }
  }

  // WHICH ACTIVITY hands a performer a skill with no MECHANISM.
  //
  // Read from `tools()` — the same discovery `check-tools.ts` uses — rather
  // than from a grep over `satisfies: [`, because that grep also matches test
  // fixtures and docstring examples and would credit coverage to nothing.
  // Measured 2026-09-26 both ways: the grep found 72 distinct satisfied
  // skills, the registry 69, and the activity-named split (32 with, 67
  // without) was the same either way.
  //
  // Deliberately NOT the corpus-wide count, which `check:tools` already
  // reports with the ruling that a skill having no Tool is not an error. This
  // is the LOCATED form of the same relation, and the location is the point.
  const toolBacked = new Set<string>();
  for (const t of tools()) for (const sk of t.satisfies) toolBacked.add(sk);
  const noTool: KgFinding[] = [];
  for (const n of activities) {
    for (const ref of n.skills) {
      if (!resolvableSkills.has(ref)) continue; // a dangling ref is `skill-ref-resolves`
      if (!toolBacked.has(ref)) {
        noTool.push({
          where: n.id,
          detail: `names skill "${ref}", which no Tool declares \`satisfies\` for — the step's mechanism is still prose.`,
        });
      }
    }
  }

  // CONVENTION REFS. The dangling direction only — see the criterion's note
  // in `kg-qa.ts` for why absence is deliberately not a finding.
  const conventionDir = conventionsDir(REPO_ROOT);
  const knownConventions = conventionDir !== undefined && existsSync(conventionDir)
    ? new Set(readdirSync(conventionDir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)))
    : undefined;
  const danglingConvention: KgFinding[] = [];
  let conventionRefs = 0;
  if (knownConventions) {
    for (const n of m.nodes.values()) {
      for (const c of n.conventions ?? []) {
        conventionRefs += 1;
        if (!knownConventions.has(c.ref)) {
          danglingConvention.push({
            where: n.id,
            detail: `names convention \`${c.ref}\` (${c.scope} scope), which is not in ${CONVENTION_GROUP}/`,
          });
        }
      }
    }
  }

  // RACI. ONE implementation, shared with `bun run cat raci` — `raciBreaches`
  // tags each breach with its kind, so three severities can be filed
  // separately without a second copy of the rule. Two answers to "is this
  // chart sound" is the drift this whole cluster exists to prevent.
  //
  // Rows come from the model already loaded here rather than from re-reading
  // the diagram: the sidecar records that file's content hash, so a second
  // parse would be filed under the first one's hash and free to disagree.
  const raciRows = raciRowsOf(m);
  // The WIDE id set, not `graph.roles`: every RACI value IS a role reference,
  // so it resolves exactly as a lane's `<role ref>` does — down the `needs`
  // chain. Passed even with no own graph, which is what lets `raci-role-resolves`
  // be answered for a layer whose roles all live in a dependency.
  const raciAll = raciBreaches(raciRows, resolvableRoleIds);
  const raciOf = (k: RaciBreachKind): KgFinding[] =>
    raciAll.filter((b) => b.kind === k).map((b) => ({ where: b.activity, detail: b.detail }));
  // Applicable only where the diagram CLAIMS something. An activity with no
  // RACI is `n/a`, never a failure: annotation is incremental by design and
  // the rule is on what a diagram claims, not on how much it has claimed.
  const raciApplies = Boolean(graph) && raciRows.length > 0;
  /**
   * `raci-role-resolves` applies on the ROWS alone.
   *
   * The other two RACI criteria ask about the SHAPE of a claim (how many
   * accountables; is the accountable also consulted) and are left gated on the
   * own graph, unchanged. This one asks whether a named role exists, which the
   * id closure answers without any graph at all.
   */
  const raciRoleApplies = raciRows.length > 0;

  const criteria: Record<string, KgCriterionEntry> = {
    "raci-role-resolves": entry(raciOf("role-undeclared"), raciRoleApplies),
    "raci-single-accountable": entry(raciOf("accountable-count"), raciApplies),
    "raci-accountable-not-consulted": entry(raciOf("accountable-also-consulted"), raciApplies),
    // `n/a` when the diagram binds none, which is most of them — distinct
    // from `pass`, because a process with nothing to resolve has not been
    // shown to resolve anything.
    "convention-ref-resolves": entry(danglingConvention, conventionRefs > 0),
    // `unknown` outranks both: a layer whose layering is undeclared has
    // not been SHOWN to resolve its refs, and reporting that as a pass is the
    // `dh4f` defect — a clean verdict over a question nobody asked.
    "skill-ref-resolves": unjudgeableSkill.length
      ? { result: "unknown", findings: [...unjudgeableSkill, ...danglingSkill] }
      : entry(danglingSkill),
    "skill-servable": entry(unservable),
    // `n/a` for a diagram whose activities name no RESOLVING skill — there is
    // nothing whose mechanism could be asked about, which is not the same as
    // every step having one.
    "activity-skill-has-tool": entry(noTool, activities.some((n) => n.skills.some((r) => resolvableSkills.has(r)))),
    "decision-ref-resolves": entry(danglingDecision, decisionRefs.length > 0),
    // Applies whenever a lane NAMES a role, with no own graph required — the
    // ids come from the closure. `unknown` when the layering is undeclared, for
    // the same reason `skill-ref-resolves` reports it: not shown to resolve.
    "role-ref-resolves": unjudgeableRoleRef.length
      ? { result: "unknown", findings: [...unjudgeableRoleRef, ...danglingRoleRef] }
      : entry(danglingRoleRef, roleRefs.length > 0),
    "activity-in-lane": entry(noLane, m.lanes.length > 0),
    "lane-binds-role": entry(unboundLane, Boolean(graph) && m.lanes.length > 0),
    // `n/a` when nothing declares a varying performer — which is also what
    // makes the declaration VISIBLE in a sidecar: a diagram whose entry is
    // `pass` rather than `n/a` has a lane that binds no role on purpose.
    "variable-performer-declared-alone": entry(
      contradictoryPerformer,
      variablePerformer.length > 0 || contradictoryPerformer.length > 0,
    ),
    "role-carries-activity-skill": entry(skillNotCarried, Boolean(graph) && m.lanes.length > 0),
    // The lane → Role → Skill report entries (owner, 2026-10-16; declared
    // `minor` in kg-qa.ts, so reported and never gated). `n/a` when no lane
    // names a role — there is no binding to be legacy.
    "lane-role-legacy-binding": entry(legacyBindingFindings(m.lanes), m.lanes.some((l) => l.roleBinding !== undefined)),
    "task-skill-outside-lane-role": entry(
      graph ? skillsOutsideLaneRole(m.lanes, activities, graph) : [],
      Boolean(graph) && m.lanes.length > 0,
    ),
    "activity-names-skill": entry(noSkill),
    "activity-fulfilment-kind": entry(wrongKind, Boolean(graph) && kindApplicable > 0),
    // Three states: `n/a` when the diagram has no call activities; `fail` when
    // a target resolves neither locally nor in any layer across the
    // repository; `pass` when every target resolves (naming the hosting
    // layer as evidence when external). `unknown` is kept only when the
    // diagram itself could not be loaded.
    "call-activity-resolves":
      calls.length === 0
        ? { result: "n/a" as KgResult, findings: [] }
        : danglingCall.length
          ? { result: "fail" as KgResult, findings: danglingCall }
          : { result: "pass" as KgResult, findings: externalCall },
    "process-diagram-published": published,
    "activity-documented": entry(undocumented, activities.length > 0),
    "activity-calls-skill-process": entry(shouldCall, activities.length > 0),
    // `n/a` for a diagram with no decision — a linear process has nothing to
    // document here, which is not the same as having documented it.
    "gateway-documented": entry(undocumentedDecision, decisions.length > 0),
    "gateway-branches-named": entry(indistinct, decisions.length > 0),
    ...reachabilityCriteria(m),
    ...qualityCriteria(m, readFileSync(p.file, "utf-8")),
  };
  if (!graph) {
    // No role graph is a state the audit can be in, and it is not a pass.
    //
    // SIX criteria, not the seven this list used to hold (five, plus
    // `task-skill-outside-lane-role` from 2026-10-16, which needs the same
    // role objects `role-carries-activity-skill` does). `role-ref-resolves`
    // and `raci-role-resolves` were removed because they no longer need a graph
    // of this layer's own: both ask whether a named role EXISTS, and
    // `resolvableRoleIds` answers that down the `needs` chain. Leaving them here
    // overwrote a correct verdict with `unknown` — measured on a DAK base layer
    // and the content core, whose every role reference resolves in
    // cat-harness.
    //
    // The six that remain need role OBJECTS: which skills a role carries, what
    // kind of performer it is, how many accountables a row names. A set of ids
    // cannot answer those, and this layer does not hold the definitions.
    for (const id of [
      "lane-binds-role",
      "role-carries-activity-skill",
      "task-skill-outside-lane-role",
      "activity-fulfilment-kind",
      "raci-single-accountable",
      "raci-accountable-not-consulted",
    ]) {
      criteria[id] = {
        result: "unknown",
        findings: [
          {
            where: "—",
            detail:
              `no role graph declared at scenarios/roles.json, so this instance holds no role DEFINITIONS. ` +
              `Role references are still resolved — see \`role-ref-resolves\` — against the ` +
              `${resolvableRoleIds.size} role(s) reachable through this instance's \`needs\`; what cannot be ` +
              `judged here is what those roles CARRY, which needs the definition rather than the name.`,
          },
        ],
      };
    }
  }
  return report("process", m.id, rel, hash, criteria);
}



/**
 * `node-reachable` and `node-has-exit`, from the shared walk.
 *
 * The walk is in `src/workflow/reachability.ts` so it can be tested without
 * importing this script, which runs at load. `preStart` is deliberately not a
 * criterion: a node gating an entry point is correct, and reporting it would
 * make a modelling decision a permanent finding.
 */
function reachabilityCriteria(m: ProcessModel): Record<string, KgCriterionEntry> {
  const r = reachability(m);
  return {
    "node-reachable": entry(r.unreachable),
    "node-has-exit": entry(r.noExit),
  };
}

/**
 * The readability criteria, from `src/workflow/diagram-quality.ts`. The
 * drawing criteria are `n/a` for a diagram with no DI: nothing was drawn, so
 * nothing was shown to be untangled.
 */
function qualityCriteria(m: ProcessModel, xml: string): Record<string, KgCriterionEntry> {
  const layout = readLayout(xml);
  const drawn = layout.edges.size > 0;
  const q = diagramQuality(m, drawn ? layout : undefined);
  const out: Record<string, KgCriterionEntry> = {};
  for (const [id, findings] of Object.entries(q)) {
    out[id] = entry(findings, !LAYOUT_CRITERIA.has(id) || drawn);
  }
  // Readable at 100% (issue #1116): text size, labels clear of lines and boxes, lane order.
  const fit = diagramFit(xml);
  for (const id of FIT_CRITERIA) out[id] = entry(fit[id] ?? [], drawn);
  return out;
}

// ── Per-decision criteria ───────────────────────────────────────

async function auditDecisions(
  processes: LoadedProcess[],
): Promise<KgQaReport[]> {
  // Every `.dmn` under a declared processes directory, at ANY depth. Was
  // `<dir>/decisions/` alone, which placement PR3 (bean `63wl`) outgrew: a
  // decision now sits beside the diagrams that read it, in
  // `processes/<group>/decisions/`, and a flat read audited none of them.
  const decisionFiles = workflowFiles(root, corpusScopeFor(root)).filter((f) => f.endsWith(".dmn"));
  if (decisionFiles.length === 0) return [];
  const referenced = new Set<string>();
  for (const p of processes) {
    for (const n of p.model?.nodes.values() ?? []) {
      if (n.decisionRef) referenced.add(n.decisionRef.replace(/^decisions\//, ""));
    }
  }

  const out: KgQaReport[] = [];
  for (const abs of [...decisionFiles].sort()) {
    const f = basename(abs);
    const rel = relative(root, abs);
    const hash = sha256(readFileSync(abs, "utf-8"));
    // Every `<decision id>` the file declares. Read from the XML rather than
    // through the loader, because the loader needs a decision id to be given.
    const ids = [...readFileSync(abs, "utf-8").matchAll(/<(?:dmn:)?decision\s[^>]*id="([^"]+)"/g)].map((m) => m[1]!);
    if (ids.length === 0) {
      out.push(report("decision", f.replace(/\.dmn$/, ""), rel, hash, allUnknown("decision", "no <decision id=…> found in the file.")));
      continue;
    }
    const findings: KgFinding[] = [];
    for (const id of ids) {
      const ref = `${f}#${id}`;
      if (!referenced.has(ref)) {
        findings.push({ where: id, detail: `decision "${ref}" is referenced by no gateway in processes/. Either wire it with <cat-harness.processes:decision ref="decisions/${ref}"/> or delete it.` });
        continue;
      }
      try {
        const table = await loadDecisionTable(abs, id);
        if (possibleOutcomes(table).length === 0) {
          findings.push({ where: id, detail: `table "${id}" can return no outcome, so the gateway it backs can never route.` });
        }
      } catch (e) {
        findings.push({ where: id, detail: `table "${id}" will not load: ${e instanceof Error ? e.message : e}` });
      }
    }
    out.push(report("decision", f.replace(/\.dmn$/, ""), rel, hash, { "decision-outcomes-used": entry(findings) }));
  }
  return out;
}

// ── Per-role criteria ───────────────────────────────────────────

/**
 * Every skill file, across every package.
 *
 * Walks `skills/` rather than reading a manifest: a skill a manifest forgot is
 * still a file an agent can be pointed at, and the audit should see it.
 * `kg-qa/` is excluded — those are this audit's own sidecars.
 *
 * **A file that declares itself part of a skill is not a skill.** A long skill
 * split into an entry point plus siblings — the pattern `AGENTS.md` prescribes
 * for `MEMORY.md`, "keep it under 200 lines, split detail into sibling files
 * the agent reads on demand" — would otherwise be audited as several skills,
 * and each fragment measured against thresholds meant for a whole one. Found
 * exactly that way: splitting five over-length skills turned 5 findings into
 * 4 new ones on their own fragments.
 *
 * The test is the file's own `part-of:` declaration, not its path, because
 * this repo has paid for "told apart by where it happens to sit" before —
 * a declaration inside the file is the contract, a location is a coincidence.
 *
 * It cannot be used to hide a skill: the declaration only counts when the
 * named parent exists AND the file sits inside that parent's own directory,
 * so `part-of: something-else` in an arbitrary file excludes nothing.
 */
function isPartOfASkill(path: string): boolean {
  const fm = /^---\n([\s\S]*?)\n---/.exec(readFileSync(path, "utf-8"));
  const parent = fm && /^part-of:\s*(\S+)\s*$/m.exec(fm[1]!)?.[1];
  if (!parent) return false;
  const dir = dirname(path);
  return basename(dir) === parent && existsSync(join(dirname(dir), `${parent}.md`));
}

function skillFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      // A declared-but-absent directory is `dh4f`: scanning nothing and
      // reporting a clean run over it. Skipped here and surfaced by
      // `check:harness-dirs`, which is the check that owns that question.
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== KG_QA_DIRNAME) walk(p);
      } else if (e.name.endsWith(".md") && !isPartOfASkill(p) && isSkillMd(p)) {
        out.push(p);
      }
    }
  };
  for (const r of ownKgRoots(root)) walk(r);
  // Deduplicated: two declared roots may nest, and a skill found twice would
  // be audited twice into one sidecar path — the second verdict silently
  // overwriting the first, which is the collision `sidecarPath` exists to
  // avoid one level down.
  return [...new Set(out)].sort();
}

/**
 * Brevity, measured per skill and recorded in a sidecar.
 *
 * Brevity is a property of an artefact, so it belongs here rather than as
 * advice inside the skill files. "Aim for shortness" in twenty skills is
 * twenty sentences nothing measures, nothing enforces, and every future edit
 * quietly ignores. A number in a sidecar is checkable and its trend is
 * visible in the diff.
 *
 * Thresholds measured across 123 skill files on 2026-09-18: median 178,
 * p75 279, p90 391, max 1280 lines. 280 and 400 are those two percentiles
 * rounded — "longer than three quarters of its peers" rather than an opinion.
 */
function auditSkills(): KgQaReport[] {
  const out: KgQaReport[] = [];
  for (const file of skillFiles()) {
    const rel = relative(root, file);
    const lines = readFileSync(file, "utf-8").split("\n");
    const n = lines.length;

    // Headings only, and only at the same depth — two `### Why` under
    // different `##` sections are not a repeat. Comparing across depths would
    // flag every skill with a conventional structure.
    const seen = new Map<string, number>();
    const repeats: KgFinding[] = [];
    let inFence = false;
    for (const l of lines) {
      if (/^```/.test(l.trim())) { inFence = !inFence; continue; }
      if (inFence) continue;
      const m = /^(#{2,6})\s+(.+?)\s*$/.exec(l);
      if (!m) continue;
      const key = `${m[1]!.length}:${m[2]!.toLowerCase()}`;
      const prior = seen.get(key);
      if (prior !== undefined) {
        repeats.push({ where: rel, detail: `heading "${m[2]}" repeated (also at line ${prior})` });
      } else {
        seen.set(key, lines.indexOf(l) + 1);
      }
    }

    // `stub:` in the front matter, if any. Read positionally rather than with a
    // YAML parser because the front matter here is already walked line-by-line
    // above, and a stub's reason is a single scalar.
    let stubReason: string | undefined;
    if (lines[0]?.trim() === "---") {
      for (let i = 1; i < lines.length; i += 1) {
        const l = lines[i]!;
        if (l.trim() === "---") break;
        const m = /^stub:\s*(.+?)\s*$/.exec(l);
        if (m) {
          stubReason = m[1]!.replace(/^["']|["']$/g, "");
          break;
        }
      }
    }

    out.push(
      report(
        "skill",
        basename(file, ".md"),
        rel,
        createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12),
        {
          // A stub declares itself in front matter, and the DECLARATION is the
          // contract — not a filename convention, not a line count. Same rule
          // as every other node kind here: extension is a coincidence, a
          // declaration inside the file is binding.
          //
          // The reason is carried into the finding rather than summarised,
          // because "this is a stub" without "and here is what would finish it"
          // is a note nobody can act on.
          "skill-is-a-stub": entry(
            stubReason === undefined
              ? []
              : [{ where: rel, detail: stubReason }],
          ),
          "skill-is-brief": entry(
            n > 280 ? [{ where: rel, detail: `${n} lines; p75 of the skill corpus is 279.` }] : [],
          ),
          "skill-not-a-document": entry(
            n > 400 ? [{ where: rel, detail: `${n} lines; p90 is 391. At this length it is a document.` }] : [],
          ),
          "skill-no-repeated-heading": entry(repeats),
        },
      ),
    );
  }
  return out;
}

/**
 * One sidecar per Tool node, PROJECTING verdicts the dedicated checkers reach.
 *
 * ## Why this projects rather than decides
 *
 * Measured 2026-09-22, and it overturned the plan it was measured for. The
 * bean behind issue #853 called Tool nodes *"unaudited, 69 of them"*. They are
 * unaudited BY THIS SCRIPT; they are not unaudited. `check-tools.ts` and
 * `tools.test.ts` already decide `satisfies`, invoke paths, io IRIs, unsafe
 * args, alternatives and contracts, and `check-maintained-artefacts.ts`
 * decides every `maintains` claim against the assembled tree.
 *
 * A first attempt here added a `maintains` criterion of its own. That would
 * have been a **second answer** to a question `check-maintained-artefacts`
 * already answers, free to disagree with it — which is the defect the bean's
 * own "Do not" warns about, one step removed.
 *
 * So what is added is the REPORTING SURFACE, not a judgement: a committed
 * sidecar per Tool, which is what makes "unbound since it was drawn"
 * distinguishable from "broken in the commit under review". A printed verdict
 * cannot do that, and that is `AGENTS.md`'s own argument for sidecars.
 *
 * ## The two states that are not `pass`
 *
 * `n/a` where the property does not apply — a Tool with no derived
 * alternative has no choice to explain, and recording that as a pass would
 * count 100-odd non-answers as evidence.
 *
 * `unknown` for `tool-maintains-in-tree`, ALWAYS, from a checkout: the
 * artefact's presence is a fact about `_site/`, which does not exist here. The
 * finding names where the answer lives rather than pretending to be it.
 */
/**
 * The Tool nodes of the layer under audit — the repository's at the root.
 *
 * **The third cross-instance leak, and the last of the three.** The other two
 * were a `scope` declaration (repo actors judged against one layer's roles:
 * 73 false criticals) and a one-line guard in `readSatisfiers` (repo
 * capabilities against one layer's requirements: 3 more). This one was
 * neither, because the criteria are RIGHT: the six `tool-*` criteria are
 * correctly `instance`-scoped, and what was wrong is the set they read.
 * `checkTools()` took no root at all, so `--instance ./bootstrap` audited
 * cat-harness's 119 Tools as bootstrap's. Fixing it by reclassifying the
 * criteria would have thrown away the legitimate layer half — the same
 * mistake avoided in `readSatisfiers`, and the reason both fixes are in the
 * DATA rather than in the classification.
 */
const VERIFIER_IDS = VERIFIERS.map((v) => v.id);

function auditTools(instance?: string): KgQaReport[] {
  const check = checkTools(instance);
  const unresolved = unresolvedPaths(instance);

  // Indexed by tool id once, rather than filtering each list per tool: seven
  // criteria over 69 tools is 483 scans of the same arrays otherwise.
  const by = <T extends { tool: string }>(rows: readonly T[]): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.tool, [...(m.get(r.tool) ?? []), r]);
    return m;
  };
  const paths = by(unresolved);
  const dangling = by(check.danglingSatisfies);
  const unmet = by(check.unmetContracts);
  const types = by(check.unknownTypes);
  const unsafe = by(check.unsafeArgs);
  const unselectable = by(check.unselectableAlternatives);
  const alternatives = deriveAlternatives(instance === undefined ? tools() : toolsOf(instance));
  const unreadable = new Set(check.unreadableContracts);

  // SUBJECTS are this layer's own Tools, on every run. The CHECKS above
  // still read the whole checkout on the default run, because a Tool here may
  // name one there — resolution widens, coverage does not (`satisfiableSkills`
  // in `check-tools.ts`, ruling `pve3`). Until 2026-10-01 the default run
  // iterated `tools()`, so it wrote 29 sidecars about Tools that the FHIR IG
  // harness (19), the content core (4) and a DAK base layer (6) declare and audit
  // themselves — a second copy of each verdict, free to drift (Q-A PR 4).
  const out: KgQaReport[] = [];
  for (const t of toolsOf(instance ?? root)) {
    const f = (rows: { detail: string }[] | undefined): KgFinding[] =>
      (rows ?? []).map((r) => ({ where: t.id, detail: r.detail }));

    // A skill whose contract could not be READ is never agreement — the rule
    // `check-tools` states and this must not soften into a pass.
    const unreadableHere = t.satisfies.filter((sk) => unreadable.has(sk));

    out.push(
      report(
        "tool",
        t.id,
        // NULL on purpose. Tool nodes are authored in TypeScript, several to a
        // module, so there is no per-node file — and inventing one would send
        // `sidecarPath` to a path that does not exist.
        null,
        createHash("sha256").update(JSON.stringify(t)).digest("hex").slice(0, 12),
        {
          "tool-invoke-path-resolves": entry(
            f((paths.get(t.id) ?? []).map((r) => ({ detail: `${r.field}: ${r.value} (expected ${r.expected})` }))),
          ),
          "tool-satisfies-resolves": entry(
            f((dangling.get(t.id) ?? []).map((r) => ({ detail: `satisfies "${r.skill}", which no declared instance has` }))),
          ),
          "tool-satisfies-contract-met":
            unreadableHere.length > 0
              ? {
                  result: "unknown",
                  findings: unreadableHere.map((sk) => ({
                    where: t.id,
                    detail: `the input contract of "${sk}" could not be read, so agreement cannot be judged`,
                  })),
                }
              : entry(
                  f(
                    (unmet.get(t.id) ?? []).map((r) => ({
                      detail: `satisfies "${r.skill}" but has no port for ${r.missing.join(", ")} (has: ${r.has.join(", ") || "none"})`,
                    })),
                  ),
                ),
          "tool-io-types-declared": entry(
            f((types.get(t.id) ?? []).map((r) => ({ detail: `port "${r.port}" references undeclared type ${r.ref}` }))),
          ),
          "tool-args-shell-safe": entry(
            f((unsafe.get(t.id) ?? []).map((r) => ({ detail: `command-line input "${r.port}" is ${r.type}, which can carry a shell payload` }))),
          ),
          "tool-alternative-selectable": entry(
            f((unselectable.get(t.id) ?? []).map((r) => ({ detail: `has alternatives ${r.alternatives.join(", ")} and no \`selection\`` }))),
            // `n/a` rather than a pass when the Tool has no derived alternative.
            alternatives.has(t.id),
          ),
          // The downstream-tool family (bean `fq5u`): three states, and no
          // run record is never a pass. See `scripts/downstream-runs.ts`.
          "tool-downstream-fresh": toolDownstreamEntry(t, VERIFIER_IDS),
          "tool-maintains-in-tree":
            (t.maintains ?? []).length === 0
              ? { result: "n/a", findings: [] }
              : {
                  // NEVER `pass` from a checkout. See the criterion's own note.
                  result: "unknown",
                  findings: (t.maintains ?? []).map((m) => ({
                    where: t.id,
                    detail:
                      `maintains "${m.artefact}" — presence is a fact about the assembled site, not this ` +
                      `checkout. Answered by \`check:maintained-artefacts ./_site\` in the docs-site workflow.`,
                  })),
                },
        },
      ),
    );
  }
  return out;
}

function auditRoles(
  graph: RoleGraph,
  graphPath: string,
  processes: LoadedProcess[],
  actors: LoadedActor[],
  skills: Set<string>,
  stories: UserStoryGraph | undefined,
  storiesPath: string,
  /** The roles to emit a subject for; the rest of `graph` is read for resolution only. */
  subjects: ReadonlySet<string>,
): KgQaReport[] {
  // Both files: `role-has-story` reads the stories, which point at the role
  // (#1168), so a story added or removed changes a role's verdict without
  // touching roles.json.
  const hash = sha256(
    readFileSync(graphPath, "utf-8") + (existsSync(storiesPath) ? readFileSync(storiesPath, "utf-8") : ""),
  );
  const toldAs = new Set((stories?.stories ?? []).filter((s) => s.role.instance === undefined).map((s) => s.role.role));
  const rel = relative(root, graphPath);

  const explicitRefs = new Set<string>();
  for (const p of processes) {
    for (const lane of p.model?.lanes ?? []) {
      if (lane.roleRef) explicitRefs.add(lane.roleRef);
    }
  }
  // A role may inherit one that a layer it `needs` declares — `readRoleGraph`
  // accepts that parent through `needs` — so a parent resolves against the same
  // closure a lane's role ref does, not against this layer's own roles alone.
  const declared = new Set([...graph.roles.map((r) => r.id), ...resolvableRoleIds]);
  // `tested-by:` on every skill a role may carry — this layer's and every
  // layer it `needs`, the reach `resolvableSkills` has — for
  // `mechanical-role-untested`.
  const skillEdges = skillEdgeIndex([root, ...orderedDependencies(root).map((d) => d.rootPath)]);
  const anyActorDeclaresRoles = actors.some((a) => (a.roles ?? []).length > 0);

  // A skill in an opt-in sub-graph the mounting root switched off is not
  // judged here (card Q-SKILL-TOOL-LINK B): the same resolver `check:tools`
  // and `check:workflow-refs` ask, over the same layers `skillEdges` reads.
  let off: ReturnType<typeof switchedOffSkillHomes> | undefined;
  const switchedOff = (s: string): boolean => {
    off ??= switchedOffSkillHomes([root, ...orderedDependencies(root).map((d) => d.rootPath)]);
    return judgeSkillRef(s, root, off) !== undefined;
  };

  return graph.roles.filter((r) => subjects.has(r.id)).map((r) => {
    const badSkills = r.skills
      .filter((s) => !resolvableSkills.has(s) && !switchedOff(s))
      .map((s) => ({
        where: s,
        detail: `role "${r.id}" carries skill "${s}", which resolves to no skill in this instance or anything it \`needs\`.`,
      }));
    const badParents = (r.inherits ?? [])
      .filter((i) => !declared.has(i))
      .map((i) => ({ where: i, detail: `role "${r.id}" inherits "${i}", which is not declared.` }));
    // A lane names a role by its own `partitionElementRef` (or, for one more
    // release, the legacy `<bootstrap.processes:role ref>` — `LaneDef.roleRef`
    // reads both); the role lists no lanes (data-modelling step 8, #1168).
    const bindsSomething = explicitRefs.has(r.id);
    const laneFindings: KgFinding[] = bindsSomething
      ? []
      : [{ where: r.id, detail: `role "${r.id}" is named by no lane's partitionElementRef (or legacy <bootstrap.processes:role ref>) in any diagram — nothing can enter it. Either a lane lost its binding, or the role is dead.` }];

    const criteria: Record<string, KgCriterionEntry> = {
      "role-skills-resolve": entry(badSkills),
      "role-inherits-resolves": entry(badParents, (r.inherits ?? []).length > 0),
      "role-binds-a-lane": entry(laneFindings),
      // `n/a` for a role a person or an agent may take on: only a mechanical
      // role's skills are a contract to be tested (owner, 2026-10-16).
      "mechanical-role-untested": ((f) => (f === undefined ? entry([], false) : entry(f)))(
        mechanicalRoleUntested(r, graph, skillEdges),
      ),
      // The lane is the audience, so a role that READS has to be writable-for.
      "role-has-persona": !readsProse(r)
        ? entry([], false)
        : entry(
            r.persona && r.persona.trim().length > 0
              ? []
              : [{ where: r.id, detail: `role "${r.id}" has no persona — an author has nobody to write for.` }],
          ),
      // No `role-declares-voice`: a voice points at the role it addresses
      // (`activeIn.roles`), and the voices graph is a DEPENDENT layer's, so
      // this layer cannot see it — `check:voices` reports which roles no
      // voice addresses, from the side that can (#1168, B2).
      "role-has-story": !readsProse(r)
        ? entry([], false)
        : entry(
            toldAs.has(r.id)
              ? []
              : [{ where: r.id, detail: `no user story in scenarios/stories.json is told as role "${r.id}" — nothing says what this reader came to do.` }],
          ),
      // Asked of EVERY role, mechanical ones included: a store or a registry
      // plays a real role (owner, 2026-10-16), and something has to play it.
      // It was `n/a` for an `actedUpon` role until that flag was retired.
      "role-has-actor": anyActorDeclaresRoles
        ? entry(
            actors.some((a) => (a.roles ?? []).includes(r.id))
              ? []
              : [{ where: r.id, detail: `no declared actor lists role "${r.id}" as one it can take on.` }],
          )
        : {
            result: "unknown",
            findings: [
              {
                where: r.id,
                detail:
                  "the actor registry declares no `roles` on any entry, so actor-to-role eligibility could not be evaluated. " +
                  "This is a gap in the registry, not a pass.",
              },
            ],
          },
      // The other direction, and the one that was unanswerable while a role
      // carried a single kind: an actor declares this role, so is its OWN kind
      // among the kinds the role admits?
      //
      // `unknown` where no entry declares `roles` at all — the same scoping
      // `role-has-actor` uses, for the same reason, so the two directions of
      // one question cannot disagree about when it is askable.
      "actor-kind-fits-role": anyActorDeclaresRoles
        ? entry(
            actors
              .filter((a) => (a.roles ?? []).includes(r.id))
              .filter((a) => !r.actorKinds.includes(a.kind))
              .map((a) => ({
                where: a.id,
                detail:
                  `actor "${a.id}" is a ${a.kind} and declares role "${r.id}", which admits ` +
                  `${r.actorKinds.join(", ")}. Either the role is too narrow — widen its ` +
                  `\`actorKinds\` — or the actor cannot take this role on and its \`roles\` ` +
                  `list is wrong. The descriptions of both are where to settle it.`,
              })),
          )
        : {
            result: "unknown",
            findings: [
              {
                where: r.id,
                detail:
                  "the actor registry declares no `roles` on any entry, so actor-kind fit could not be evaluated. " +
                  "This is a gap in the registry, not a pass.",
              },
            ],
          },
    };
    return report("role", r.id, rel, hash, criteria);
  });
}

// ── Per-requirement criteria ────────────────────────────────────

/**
 * Requirements are the fifth KG node kind, and the last one whose joins went
 * unchecked.
 *
 * A requirement is not a skill and not a role: it is a conformance obligation
 * that POINTS AT them. `satisfiedBy` names the skill or capability that
 * discharges a statement, `actors` names who is bound by it, and `derivedFrom`
 * names the broader requirement it specialises. Three reference types, and
 * until now nothing resolved any of them — measured on 2026-09-18, one
 * `satisfiedBy` and three `derivedFrom` refs pointed at nothing.
 *
 * They are `critical` rather than `major` for the same reason a dangling
 * `<bootstrap.processes:skill ref>` is: a reader following the reference gets nothing. The
 * grading check is `major` — an ungraded statement is still readable, it just
 * cannot be conformance-tested.
 */
interface LoadedRequirement {
  id: string;
  file: string;
  path: string;
  raw: {
    id?: string;
    derivedFrom?: string[];
    actors?: string[];
    statements?: { key?: string; conformance?: string; actors?: string[] }[];
  };
}

function readRequirements(dir: string = REQUIREMENT_DIR): LoadedRequirement[] {
  if (!existsSync(dir)) return [];
  const out: LoadedRequirement[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const p = join(dir, f);
    try {
      const raw = JSON.parse(readFileSync(p, "utf-8")) as LoadedRequirement["raw"];
      out.push({ id: raw.id ?? f.slice(0, -5), file: f, path: p, raw });
    } catch (e) {
      throw new Error(`${p} is not valid JSON: ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}

/**
 * Every value of a list-valued front-matter key across the skill files, with
 * the file that declares it. A front matter that does not parse is skipped:
 * that is `check:skill-front-matter`'s finding, not this one's.
 */
function frontMatterLists(key: string): { value: string; from: string }[] {
  const out: { value: string; from: string }[] = [];
  const line = new RegExp(`^${key}:`, "m");
  for (const file of skillFiles()) {
    const fm = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, "utf-8"));
    if (!fm || !line.test(fm[1]!)) continue;
    let parsed: unknown;
    try {
      parsed = parseYaml(fm[1]!);
    } catch {
      continue;
    }
    const values = (parsed as Record<string, unknown>)[key];
    for (const v of Array.isArray(values) ? values : []) out.push({ value: String(v), from: relative(root, file) });
  }
  return out;
}

/**
 * The `graph-typologies:` a skill names that are not registered kinds (#1168, B3).
 * The skill says which kinds it reads; the kind names no skill.
 */
function unknownSkillGraphTypologies(): KgFinding[] {
  return frontMatterLists("graph-typologies")
    .filter(({ value }) => !defaultGraphTypologies.has(value))
    .map(({ value, from }) => ({ where: from, detail: `names graph typology "${value}", which is not registered.` }));
}

/**
 * A skill's `input:`/`output:` that is malformed or names a local file that is
 * not there (#1168, B3b). An external https IRI is not fetched here.
 */
function brokenSkillContracts(): KgFinding[] {
  const out: KgFinding[] = [];
  for (const c of skillContracts(root).values()) {
    for (const io of ["input", "output"] as const) {
      const ref = c[io];
      if (ref === undefined) continue;
      const shape = contractRefProblem(ref);
      const file = contractFile(c.instanceRoot, ref);
      if (shape) out.push({ where: c.from, detail: `${io}: ${ref} — ${shape}.` });
      else if (file !== undefined && !existsSync(file)) {
        out.push({ where: c.from, detail: `${io}: ${ref} — no such file in this instance.` });
      }
    }
  }
  return out;
}

/**
 * A contract file no skill names (#1168, B3b). The skill points at its
 * contract, so a contract nothing points at is specified for nobody.
 */
function unclaimedSkillContracts(): KgFinding[] {
  // EVERY declared `schemas` directory, not one. Asking for one threw outright on
  // a layer that declares two — `kg:audit --instance ./large-datasets` never
  // audited at all, it crashed inside `instanceDirectoryForGraph`. Declaring a
  // kind twice is legal and `cat-harness.json` does it, so the singular accessor
  // was simply the wrong question here; its refusal to guess is correct and is
  // why this reads plural instead of taking `[0]`.
  //
  // declared-path-literal: the conventional fallback when no declaration names one.
  const declared = instanceDirectoriesForGraph(root, "schemas");
  const dirs = (declared.length > 0 ? declared : [join(root, "schemas")])
    .map((d) => join(d, "skills"))
    .filter((d) => existsSync(d));
  if (dirs.length === 0) return [];
  // Keyed by ABSOLUTE path: a ref is relative to the layer holding its
  // skill, which from the checkout is not always `root` (placement PR1).
  const claimed = new Set<string>();
  for (const c of skillContracts(root).values()) {
    for (const ref of [c.input, c.output]) if (ref !== undefined) claimed.add(resolve(c.instanceRoot, ref));
  }
  const out: KgFinding[] = [];
  for (const dir of dirs) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      for (const f of readdirSync(join(dir, e.name))) {
        if (!f.endsWith(".schema.json")) continue;
        const ref = relative(root, join(dir, e.name, f));
        if (!claimed.has(resolve(dir, e.name, f))) out.push({ where: ref, detail: `no skill names ${ref} as its input or output.` });
      }
    }
  }
  return out;
}

/**
 * Every arrow from a general node, checked against the rule that the
 * dependent holds the pointer (#1168, B5). `unknown` when the schema graph
 * cannot be read: a check over nothing is not a pass.
 */
function arrowDirection(): KgCriterionEntry {
  const graph = readSchemaGraph(root);
  if (graph === null) {
    return { result: "unknown", findings: [{ where: "—", detail: "no schemas directory to read `@general` declarations from." }] };
  }
  const perFile = workflowFiles(root, corpusScopeFor(root))
    .filter((f) => f.endsWith(".bpmn"))
    .map((f) => processArrowFindings(relative(root, f), readFileSync(f, "utf-8")));
  // Zero extension elements across every diagram means the reader matched
  // nothing — the prefix-drift failure this check has already had once — so
  // it is `unknown`, never a clean run.
  if (perFile.reduce((n, r) => n + r.examined, 0) === 0) {
    return { result: "unknown", findings: [{ where: "—", detail: "no BPMN extension element was found in any diagram, so the process half checked nothing." }] };
  }
  return entry([...schemaArrowFindings(graph), ...perFile.flatMap((r) => r.findings)]);
}

/**
 * Do the files a general node's PROSE names still exist (bean `epbt`)?
 *
 * Advisory. Prose may name a dependent as explanation — the owner kept that
 * on 2026-09-24 — but it cannot notice a rename, so a path whose directory is
 * here and whose file is not is listed. A bare name nothing here carries is
 * undetermined (an output, a folio's file, an example) and never a finding.
 */
function proseNamesResolve(): KgCriterionEntry {
  const repo = REPO_ROOT;
  // input-site: tree #af526755 — ls-files: the index
  const ls = Bun.spawnSync(["git", "ls-files"], { cwd: repo });
  if (ls.exitCode !== 0) {
    return { result: "unknown", findings: [{ where: "—", detail: "`git ls-files` failed, so a bare file name cannot be looked up." }] };
  }
  const basenames = new Set(new TextDecoder().decode(ls.stdout).split("\n").map((f) => f.split("/").pop()!));
  // Every layer's root, not only this one: `materialize-remote.bpmn`
  // names `schemas/materialization.ts`, which is the content core's, and
  // prose spells a sibling layer's path from that layer's root.
  const roots = [
    repo,
    root,
    ...readdirSync(repo, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
      .map((e) => join(repo, e.name)),
  ];
  const texts: { where: string; prose: string }[] = workflowFiles(root, corpusScopeFor(root))
    .filter((f) => f.endsWith(".bpmn"))
    .map((f) => ({ where: relative(root, f), prose: diagramProse(readFileSync(f, "utf-8")) }));
  const graph = readSchemaGraph(root);
  const generalModules = new Set((graph?.decls ?? []).filter((d) => d.general).map((d) => d.module));
  for (const m of generalModules) {
    for (const d of generalDeclarationProse(readFileSync(join(repo, m), "utf-8"))) {
      texts.push({ where: `${m}#${d.name}`, prose: d.prose });
    }
  }
  let named = 0;
  const findings: KgFinding[] = [];
  for (const t of texts) {
    for (const n of namedFiles(t.prose)) {
      named++;
      if (classifyName(n, roots, basenames) === "missing") {
        findings.push({ where: t.where, detail: `names \`${n}\`: its directory is here and the file is not — renamed, moved, or never written.` });
      }
    }
  }
  // Zero names over every general node is a reader that matched nothing.
  if (named === 0) {
    return { result: "unknown", findings: [{ where: "—", detail: "no file name was found in any general node's prose, so nothing was checked." }] };
  }
  return entry(findings);
}

/**
 * The recorded test runs, followed to the skill each names and on to that
 * skill's contract (#1168, B4). Three criteria rather than one, because
 * "could not check" is a different finding from "checked and wrong".
 */
function testRunCriteria(skills: Set<string>): Record<string, KgCriterionEntry> {
  // declared-path-literal: the conventional fallback when no declaration names the directory
  const resultsDir = ownDirectoryById(root, "qa", "test/results");
  const r = checkTestRuns(root, resultsDir, skills, () => {
    if (!against) return { looked: false, files: [] };
    const storage = qaStorageOf(resultsDir);
    if (!storage) return { looked: false, files: [] };
    const tree = readQaTree(against, resultsDir, { branch: storage, repoRoot: REPO_ROOT });
    if (tree.state !== "hit") return { looked: false, files: [] };
    const prefix = tree.prefix ? `${tree.prefix}/` : "";
    const files: { where: string; text: string }[] = [];
    for (const [p, text] of [...tree.files.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const relToResults = prefix && p.startsWith(prefix) ? p.slice(prefix.length) : p;
      if (!relToResults.includes("/") && relToResults.endsWith(".test-run.json")) {
        files.push({ where: relative(root, join(resultsDir, relToResults)), text });
      }
    }
    return { looked: true, files };
  }, {
    // A committed results directory is its own record, so its presence is
    // determined. A branch-stored one is derived: an empty copy may be another
    // writer's side effect, so it counts only while qa:refresh computes it
    // (cat-harness-tools#759, owner's choice A).
    // input-site: env QA_WORKING_COPY_BUILDING #a73dcccf — BUILDING_ENV: whether an empty branch-stored results copy is determined
    determined: process.env[BUILDING_ENV] === "1" || qaStorageOf(resultsDir) === undefined,
  });
  // Only a DECLARED `qa` directory that is absent is unknown. A layer that
  // declares none (bootstrap, …) has no results to read, and its
  // missing conventional directory is a determined "no runs": `n/a`.
  const qaDeclared = resolveDirectories([{ name: "(local)", root, own: true }]).some(
    (d) => d.id === "qa" && d.own && d.scope !== "repository" && d.declaredBy !== "(default)",
  );
  if (!r.looked && qaDeclared) {
    // Neither the checkout nor a readable store holds the runs. A repository
    // that mounts this layer cannot read its store (it lives on another
    // repository), so compute them: each run's writer is declared, and one
    // marked `testRunOutEnv` writes only into a temporary directory, so
    // judge mode still writes nothing (cat-harness-tools#1191).
    const computed = WORKSPACE_ROOT ? computeTestRuns(resultsDir, WORKSPACE_ROOT) : { reason: "no workspace holds both layers" };
    if ("dir" in computed) {
      try {
        const c = checkTestRuns(root, computed.dir, skills, undefined, { determined: true });
        const rel = relative(root, resultsDir);
        const rename = (fs: RunFinding[]): RunFinding[] => fs.map((f) => ({ ...f, where: computedWhere(f.where, rel) }));
        const any = c.runs > 0;
        return {
          "test-run-skill-resolves": entry(rename(c.unresolved), any),
          "test-run-conforms": entry(rename(c.nonconforming), any),
          "test-run-checkable": entry(rename(c.unchecked), any),
        };
      } finally {
        computed.done();
      }
    }
    // A declared results directory that is absent says nothing about whether
    // runs exist — since 5hox it is derived and may not be computed or fetched
    // yet. `n/a` would be the false pass audit C5 names (bean `2gst`).
    const unknown = (): KgCriterionEntry => ({
      result: "unknown",
      findings: [{ where: "—", detail: `the QA results directory is absent, so recorded test runs could not be read, and they could not be computed here (${computed.reason}). Compute it (\`bun run cat qa:refresh\`) or fetch it (\`bun run cat qa:fetch\`).` }],
    });
    return { "test-run-skill-resolves": unknown(), "test-run-conforms": unknown(), "test-run-checkable": unknown() };
  }
  const any = r.runs > 0;
  return {
    "test-run-skill-resolves": entry(r.unresolved, any),
    "test-run-conforms": entry(r.nonconforming, any),
    "test-run-checkable": entry(r.unchecked, any),
  };
}

/**
 * The test process's four criteria (bean `3o5b`): plans, the runs that
 * execute them and the reports they produce, followed to each other. The
 * rules live in the schemas; `test-plan-audit.ts` follows the files.
 */
function testPlanCriteria(actors: LoadedActor[]): Record<string, KgCriterionEntry> {
  const planFiles = jsonFilesUnder(instanceDirectoriesForGraph(root, "test-plan"));
  return {
    ...auditTestPlans({
      root,
      dmnBases: [WORKFLOW_DIR],
      plans: planFiles,
      // declared-path-literal: the conventional fallback when no declaration names the directory
      runs: testRunFiles(ownDirectoryById(root, "qa", "test/results")),
      reports: jsonFilesUnder(instanceDirectoriesForGraph(root, "test-report")),
      actors,
    }),
    "test-plan-exit-criteria-resolves": auditTestPlanExitCriteria({
      root,
      plans: planFiles,
      dmnBases: [WORKFLOW_DIR],
    }),
    // Owner, 2026-11-06: every test has a Gherkin, and every plan case names one.
    "test-has-gherkin": auditTestGherkin({ root, plans: planFiles }),
    // Bean `zaui`: the certifications `A_FileCertification` files, judged.
    "certification-resolves": auditCertifications({
      root,
      plans: planFiles,
      files: jsonFilesUnder([join(ATT_HOME.root, CERTIFICATION_FAMILY)]),
    }),
  };
}

/** One declared `satisfies` ref, and who declared it. */
interface Satisfier {
  /** `req:<requirement>#<statement key>`. */
  ref: string;
  /** The declaring file, repo-relative — a skill `.md` or a capability `.json`. */
  from: string;
}

/**
 * Every `satisfies` ref a skill or capability declares (#1168, B3).
 *
 * The satisfier holds the pointer; the requirement statement names nobody. A
 * skill declares it in its front matter, a capability in its JSON.
 */
function readSatisfiers(): Satisfier[] {
  const out: Satisfier[] = frontMatterLists("satisfies").map(({ value, from }) => ({ ref: value, from }));
  // CAPABILITY_DIR is repository-level (`repoRootFor`), so its claims are the
  // REPOSITORY's to judge — and it judges them correctly: `satisfies-resolves`
  // passes with 0 findings at the root.
  //
  // Reading them in an instance run compares a repository-level satisfier set
  // against ONE layer's requirement set, which is the same cross-level shape
  // as `actor-roles-resolve`. MEASURED 2026-09-26 on `--instance ./bootstrap`:
  // three criticals, every one citing `../.claude/skills/capabilities/*.json` —
  // a `where` that escapes the layer being audited, which is the tell.
  //
  // Skipped rather than suppressing the criterion, because the layer half is
  // a real question: a front-matter `satisfies` inside this layer still
  // resolves against this layer's requirements. Suppressing
  // `satisfies-resolves` outright would have thrown that away to fix the repo
  // half.
  if (!INSTANCE_RUN && existsSync(CAPABILITY_DIR)) {
    for (const f of readdirSync(CAPABILITY_DIR)) {
      if (!f.endsWith(".json")) continue;
      const path = join(CAPABILITY_DIR, f);
      const refs = (JSON.parse(readFileSync(path, "utf-8")) as { satisfies?: unknown }).satisfies;
      for (const r of Array.isArray(refs) ? refs : []) out.push({ ref: String(r), from: relative(root, path) });
    }
  }
  return out;
}

/**
 * The requirement ids a `derivedFrom` in this layer may name: its own, plus
 * those of every layer it declares `needs` on, transitively (bean `w1gy`,
 * owner option A, 2026-10-30).
 *
 * The same widening {@link resolvableSkills} and `resolvableRoleIds` make, and
 * that actors get through `neededActors`: a requirement may specialise one a
 * lower layer declares — fhir-harness's `req:fhir-validation` derives from
 * cat-harness's `req:content-lifecycle` — and that is not a dangling ref.
 * Subjecthood does not widen: only this layer's own requirements are
 * audited, so a dependency's are read for their ids alone.
 */
function resolvableRequirementIds(own: LoadedRequirement[]): Set<string> {
  const out = new Set(own.map((r) => r.id));
  for (const dep of orderedDependencies(root)) {
    try {
      // declared-path-literal: the convention fallback, at the call site, as
      // `REQUIREMENT_DIR` is the own layer's `skills/requirements`.
      for (const r of readRequirements(join(ownDirectoryById(dep.rootPath, "skills", "skills"), "requirements"))) out.add(r.id);
    } catch {
      // A dependency's unreadable requirement is that layer's own audit's
      // finding; one broken dependency must not block every dependent.
    }
  }
  return out;
}

function auditRequirements(
  reqs: LoadedRequirement[],
  actors: LoadedActor[],
  satisfiers: Satisfier[],
): KgQaReport[] {
  const actorIds = new Set(actors.map((a) => a.id));
  const reqIds = resolvableRequirementIds(reqs);

  return reqs.map((r) => {
    const mine = satisfiers.filter((s) => s.ref.startsWith(`${r.id}#`)).sort((x, y) => (x.ref + x.from).localeCompare(y.ref + y.from));
    // The requirement file AND the satisfiers that name it: a skill that
    // starts or stops satisfying a statement changes this verdict without
    // touching the requirement.
    const hash = sha256(readFileSync(r.path, "utf-8") + JSON.stringify(mine));
    const unsatisfied: KgFinding[] = [];
    const badActors: KgFinding[] = [];
    const ungraded: KgFinding[] = [];

    for (const a of r.raw.actors ?? []) {
      if (!actorIds.has(a)) badActors.push({ where: r.id, detail: `binds actor "${a}", which the registry does not declare.` });
    }
    for (const st of r.raw.statements ?? []) {
      const key = st.key ?? "(unkeyed)";
      if (!st.conformance) {
        ungraded.push({ where: key, detail: `statement "${key}" carries no \`conformance\` grade — it cannot be conformance-tested.` });
      }
      for (const a of st.actors ?? []) {
        if (!actorIds.has(a)) badActors.push({ where: `${r.id}/${key}`, detail: `binds actor "${a}", which the registry does not declare.` });
      }
      if (!mine.some((s) => s.ref === `${r.id}#${key}`)) {
        unsatisfied.push({
          where: `${r.id}/${key}`,
          detail: `no skill or capability declares \`satisfies: ${r.id}#${key}\` — nothing is recorded as discharging this statement.`,
        });
      }
    }
    const badParents = (r.raw.derivedFrom ?? [])
      .filter((d) => !reqIds.has(d))
      .map((d) => ({ where: r.id, detail: `derives from "${d}", which is declared in no requirement of this instance or anything it \`needs\`.` }));

    const criteria: Record<string, KgCriterionEntry> = {
      "requirement-statement-satisfied": entry(unsatisfied, (r.raw.statements ?? []).length > 0),
      "requirement-actors-resolve": entry(badActors),
      "requirement-derived-from-resolves": entry(badParents, (r.raw.derivedFrom ?? []).length > 0),
      "requirement-statements-graded": entry(ungraded, (r.raw.statements ?? []).length > 0),
    };
    return report("requirement", r.id, relative(root, r.path), hash, criteria);
  });
}

/** The satisfies refs that name no declared requirement statement. */
function danglingSatisfies(reqs: LoadedRequirement[], satisfiers: Satisfier[]): KgFinding[] {
  const declared = new Set(reqs.flatMap((r) => (r.raw.statements ?? []).map((st) => `${r.id}#${st.key ?? ""}`)));
  return satisfiers
    .filter((s) => !declared.has(s.ref))
    .map((s) => ({
      where: s.from,
      detail: `declares \`satisfies: ${s.ref}\`, which is not a declared requirement statement — the claim cannot be checked against anything.`,
    }));
}

// ── Graph roll-up ───────────────────────────────────────────────

/**
 * Every package manifest this layer declares, with the package it names.
 *
 * ## Two defects this replaces, and both were the same shape
 *
 * `manifestSkills` and `manifestEntries` each walked `join(root, "skills")` and
 * each scanned exactly one level of subdirectories. So:
 *
 * 1. **The path was hardcoded**, not read from the declaration. That is the
 *    defect `harness.json` exists to remove, and the third instance of it found
 *    in two days — `KG_ROOT` here and `SKILLS_CATEGORIES` in `gen-skill-docs`
 *    were the others. A hardcoded root scans the wrong tree the moment the
 *    layout moves, which it did on 2026-09-20.
 * 2. **A manifest AT a declared directory was invisible**, because the walk only
 *    looked inside subdirectories. `gen-skill-docs` already documents that two
 *    declared directories — `bootstrap` and `cat-harness-src` — "hold their
 *    skills DIRECTLY rather than in package subdirectories". So a manifest for
 *    those could not be found however correctly it was written, which is why
 *    `confirm-harness` reported as listed by no package manifest while being
 *    perfectly declarable.
 *
 * One walk now, returning both shapes the callers wanted, so the two cannot
 * drift apart again.
 */
function manifestPackages(): { pkg: string; skill: string }[] {
  const out: { pkg: string; skill: string }[] = [];
  const read = (mp: string, pkg: string): void => {
    if (!existsSync(mp)) return;
    try {
      const m = JSON.parse(readFileSync(mp, "utf-8")) as { skills?: string[] };
      for (const s of m.skills ?? []) out.push({ pkg, skill: s });
    } catch {
      // A manifest that will not parse is `validate-skills.ts`'s finding, not
      // this one's. Treating it as "declares nothing" here would turn one
      // defect into a hundred unrelated orphan reports.
    }
  };
  for (const d of kgDirectories(root, corpusScopeFor(root))) {
    // A manifest at the declared directory itself: the shape `bootstrap` and
    // `cat-harness-src` use.
    read(join(d.absPath, "package-manifest.json"), d.id);
    if (!existsSync(d.absPath)) continue;
    // ...and one per package subdirectory: the shape `skills/` uses.
    for (const e of readdirSync(d.absPath, { withFileTypes: true })) {
      if (e.isDirectory()) read(join(d.absPath, e.name, "package-manifest.json"), e.name);
    }
  }
  return out;
}

function manifestSkills(): Set<string> {
  return new Set(manifestPackages().map((m) => m.skill));
}

/**
 * Every skill `skill_fetch` can actually hand to an agent.
 *
 * Read from `LOCAL_PACKAGES` in `src/tools/skill-fetch.ts` rather than from a
 * list here, because a second copy of "which directories are served" is a
 * second answer free to disagree with the first — and the whole defect this
 * criterion exists for was a directory missing from that one table.
 */
function servableSkills(): Set<string> {
  const out = new Set<string>();
  for (const dir of Object.values(LOCAL_PACKAGES)) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith(".md")) out.add(f.slice(0, -3));
  }
  return out;
}

/**
 * Skills the Claude Code harness loads directly from `.claude/skills/local/`.
 *
 * Reachable without any manifest or package: the harness reads the directory.
 * `scripts/generate-registry.ts` treats this same directory, and only this one
 * under `.claude/skills/`, as `SkillDefinition`.
 */
function localHarnessSkills(): Set<string> {
  const out = new Set<string>();
  // The `.md` bodies stay in the agent harness's `.claude/skills/local/`; the
  // JSON definitions moved by theme into each owner's `skill-definitions/`
  // (bean `rqao`).
  const dir = join(REPO_ROOT, ".claude", "skills", "local");
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith(".md")) out.add(f.slice(0, -3));
  for (const d of skillDefinitionDirs(REPO_ROOT)) {
    for (const f of readdirSync(d)) if (f.endsWith(".json")) out.add(f.slice(0, -5));
  }
  return out;
}

/** Manifest entries, with the package each came from, for the reverse check. */
function manifestEntries(): { pkg: string; skill: string }[] {
  return manifestPackages();
}

/**
 * Nested layers in this tree whose graph this audit does not read.
 *
 * ## Why this is reported rather than fixed
 *
 * Reading them would be the defect. `instance-graph-isolation.test.ts` guards a
 * leak that was LIVE on 2026-09-19: a filesystem walk discovered
 * `bootstrap/processes/` from the repository root and put 88 references to a
 * bootstrap process into folio-assistant's published graph. One layer's graph
 * must not carry another's nodes, and this audit is right not to.
 *
 * What was wrong is that nothing said so. The silence was read as a blind spot on
 * 2026-09-20 and "fixed" by declaring the nested directory at the root, which
 * re-introduced that leak until the test stopped it. So the unread corpus is
 * counted here: a reported number is not deducible-and-mis-deducible.
 *
 * A declaration counts as a layer when it names `directories`. That excludes
 * `docs/_data/harness.json`, which `sync-docs-harness` writes with the
 * reader-facing fields only — a Jekyll data file, not a layer.
 */
function unreadNestedInstances(): KgFinding[] {
  const repo = REPO_ROOT;
  const out: KgFinding[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 3) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        walk(p, depth + 1);
        continue;
      }
      if (!e.name.endsWith(DECLARATION_SUFFIX)) continue;
      // Not this audit's own layer, whichever directory that is.
      if (resolve(dir) === resolve(root)) continue;
      let decl: { directories?: unknown[]; name?: string };
      try {
        decl = JSON.parse(readFileSync(p, "utf-8")) as typeof decl;
      } catch {
        continue;
      }
      if (!Array.isArray(decl.directories) || decl.directories.length === 0) continue;
      const diagrams = workflowFiles(dir).filter((f) => f.endsWith(".bpmn")).length;
      out.push({
        where: relative(repo, p),
        detail:
          `nested instance "${decl.name ?? relative(repo, dir)}" declares its own graph, and this audit ` +
          `does not read it — ${diagrams} diagram(s) there are unaudited by this run. That is correct: ` +
          `one instance's graph must not carry another's nodes. Audit it from its OWN root, and do NOT ` +
          `declare its directories here — that re-introduces the leak ` +
          `instance-graph-isolation.test.ts guards.`,
      });
    }
  };
  walk(repo, 0);
  return out.sort((a, b) => a.where.localeCompare(b.where));
}

/** `content-instance-holds-code`, from {@link contentInstanceCode}: n/a, unknown, or one finding per file. */
function contentInstanceHoldsCode(): KgCriterionEntry {
  const v = contentInstanceCode(root);
  if (v.state === "n/a") return entry([], false);
  if (v.state === "unknown") return { result: "unknown", findings: [{ where: "—", detail: v.reason }] };
  return entry(contentCodeFindings(v));
}

/**
 * The graph directories this audit actually read, as a phrase for a finding.
 *
 * ## Why every graph-ranging finding has to carry this
 *
 * A finding that says a skill is "named by no activity" is true OF THE GRAPH IT
 * RANGED OVER and says nothing about any other. Worded absolutely it reads as a
 * fact about the repository, and on 2026-09-20 a session read it that way:
 * `confirm-harness` is named three times by `bootstrap/processes/`, which this
 * audit does not read, so the absolute wording looked like a blind spot. The
 * session "fixed" it by declaring that directory at the root and re-introduced a
 * defect `instance-graph-isolation.test.ts` had been written the day before to
 * prevent — one layer's graph carrying another's nodes, which had put 88
 * references to a bootstrap process into folio-assistant's published graph.
 *
 * The isolation is correct and the scoping is correct. **Only the sentence was
 * wrong**, and it cost a change a test had to stop. Bean `sa8y`.
 */
function graphScope(): string {
  // No filter: `kgDirectories` already returns only the declared
  // knowledge-graph directories, which is exactly the set this audit walks.
  //
  // The DECLARED path string, not a computed relative one. Computing it against
  // this script's root printed `../bootstrap/skills` once the tree moved into
  // `cat-harness/`, which is accurate and reads like a bug — and it is the
  // declaration that a reader would go and edit. "Resolve, do not compose",
  // applied to a diagnostic rather than to a link.
  const dirs = kgDirectories(root, corpusScopeFor(root)).map((d) => `\`${d.id}\` at \`${d.path}\``);
  return dirs.length > 0 ? dirs.join(", ") : "no knowledge-graph directory declared";
}

/** Appended to any finding whose range is this layer's graph and not the tree. */
function scopedToThisGraph(): string {
  return (
    ` In this instance's graph only (read: ${graphScope()}) —` +
    " a nested instance may name it, and this audit does not read one."
  );
}

function auditGraph(
  graph: RoleGraph | undefined,
  processes: LoadedProcess[],
  actors: LoadedActor[],
  skills: Set<string>,
  stories: UserStoryGraph | undefined,
  badSatisfies: KgFinding[],
  unsharedGlobalTasks: KgFinding[],
): KgQaReport {
  const reachable = manifestSkills();
  for (const s of servableSkills()) reachable.add(s);
  for (const s of localHarnessSkills()) reachable.add(s);
  for (const r of graph?.roles ?? []) for (const s of r.skills) reachable.add(s);
  for (const p of processes) {
    for (const n of p.model?.nodes.values() ?? []) for (const s of n.skills) reachable.add(s);
  }
  const orphans = [...skills]
    .filter((s) => !reachable.has(s))
    .sort()
    .map((s) => ({
      where: s,
      detail:
        `skill "${s}" is listed by no package manifest, carried by no role and named by no activity.` +
        scopedToThisGraph(),
    }));

  // The OTHER question, asked separately because the answers differ by two
  // orders of magnitude: what does the actor → role → task model actually
  // reach? `reachable` above is dominated by the servable clause, so it passes
  // over almost everything; this counts only the two clauses that are part of
  // the process model. Coverage, never a gate — see the criterion's note.
  const modelled = new Set<string>();
  for (const r of graph?.roles ?? []) for (const s of r.skills) modelled.add(s);
  for (const p of processes) {
    for (const n of p.model?.nodes.values() ?? []) for (const s of n.skills) modelled.add(s);
  }
  // `consulted: true` is skipped, and that is the criterion becoming
  // MEANINGFUL rather than being relaxed. A skill that is reference material
  // belongs in no lane by its nature — `directory-conventions` is what a
  // performer reads, not a step anybody takes — so counting it as unbound
  // measured the criterion rather than the corpus. Bean `y1w9`.
  const consulted = consultedSkills(root, corpusScopeFor(root));
  // A skill that must never reach a published graph cannot be carried by a
  // published role either, so reporting it as unbound measures the strip
  // rather than the corpus.
  //
  // `fsh-guts` is the standing case and it is STRUCTURAL, not an oversight:
  // a role carrying it emits a dangling `hasSkill` edge into the export,
  // because every emitter strips the node while the edge keeps its name.
  // Measured 2026-09-20 — adding it to `docs-authoring-agent` broke
  // `kg-export.test.ts` on exactly that. So the criterion would report it
  // forever and the only "fix" available would re-introduce the leak the
  // owner's "NEVER include fsh-guts in the KG" rule exists to prevent.
  //
  // Exempting on the DECLARATION rather than on the name, per the owner's
  // 2026-09-20 answer: the skill says `published: false` in its own front
  // matter, and this reads what it said. The narrower, safer direction is
  // deliberate — a skill is exempt here only because it opted out of
  // publication, never merely because nothing happens to bind it.
  const unpublished = unpublishedSkills(root, corpusScopeFor(root));
  const unmodelled = [...skills]
    .filter((s) => !modelled.has(s) && !consulted.has(s) && !unpublished.has(s))
    .sort()
    .map((s) => ({
      where: s,
      detail:
        `no role carries "${s}" and no activity names it — reached, if at all, by direct invocation.` +
        scopedToThisGraph(),
    }));

  // The OTHER direction, and the reason the exemption is safe to grant. A
  // skill cannot be reference material AND a step somebody performs: if a
  // lane or a role claims it, either the annotation is wrong or the binding
  // is. Without this, `consulted: true` would be an unfalsifiable opt-out of
  // the criterion, which is a worse field than the one `qif9` removed.
  const consultedButPerformed = [...consulted]
    .filter((s) => modelled.has(s))
    .sort()
    .map((s) => ({
      where: s,
      detail:
        `"${s}" declares \`consulted: true\` — reference material nobody performs — ` +
        `but a role carries it or an activity names it. One of the two is wrong.` +
        scopedToThisGraph(),
    }));

  const declaredRoles = new Set((graph?.roles ?? []).map((r) => r.id));
  const badActorRoles = actors.flatMap((a) =>
    (a.roles ?? [])
      .filter((r) => !declaredRoles.has(r))
      .map((r) => ({
        where: a.id,
        detail: `${relative(root, a.path)} lists role "${r}", which the role graph does not declare.`,
      })),
  );

  // Over the SAME layers the actors were read from (see `actors` below): an
  // actor a higher layer declares may claim a capability declared beside it.
  const capabilities = declaredCapabilityIds(root, CAPABILITY_DIR, ACTOR_SCOPE);
  const badCaps = unresolvedActorCapabilities(root, actors, capabilities);

  // The folio ODRL profile is declared once, by the platform: a layer that
  // declares none of its own (one whose actors' grants live in its own
  // policies/) names the profile's actions, as `core/access.ts` reads them.
  const vocabulary =
    readPermissions(KG_ROOT) ?? kgRoots(root).map((r) => readPermissions(r)).find((v) => v !== undefined);
  const declaredPerms = new Set((vocabulary?.permissions ?? []).map((p) => p.id));
  const badPerms: KgFinding[] = [];
  // The ODRL side (issue #1180): every rule's action is declared (or ODRL's
  // own), and every assignee is an actor or `folio:anyone`. A rule naming an
  // actor that does not exist grants nothing, silently; a rule naming an
  // undeclared action cannot be placed in the includedIn graph at all.
  const actorIds = new Set(actors.map((a) => a.id));
  for (const policy of readPolicies(POLICY_DIR).values()) {
    for (const rule of [...policy.permission, ...policy.prohibition]) {
      if (!declaredPerms.has(rule.action) && !(rule.action in ODRL_ACTIONS)) {
        badPerms.push({
          where: policy.uid,
          detail: `policy ${policy.uid} names action "${rule.action}", which skills/permissions/permissions.json does not declare.`,
        });
      }
      if (rule.assignee !== ANYONE && !actorIds.has(rule.assignee)) {
        badPerms.push({
          where: policy.uid,
          detail: `policy ${policy.uid} assigns "${rule.action}" to "${rule.assignee}", which is not a declared actor.`,
        });
      }
    }
  }
  for (const a of actors) {
    for (const perm of a.permissions ?? []) {
      if (!declaredPerms.has(perm)) {
        badPerms.push({
          where: a.id,
          detail: `${relative(root, a.path)} claims permission "${perm}", which skills/permissions/permissions.json does not declare.`,
        });
      }
    }
  }

  const roleish = actors
    .filter((a) => a.looksLikeRole)
    .map((a) => ({ where: a.id, detail: `${relative(root, a.path)} carries \`inherits\` — an actor does not inherit, a role does. Migration debt from before roles were declared.` }));

  return report(
    "graph",
    "kg",
    null,
    null,
    {
      "skill-has-entry-point": entry(orphans),
      // A report entry (`minor`): the spec's rule for global tasks, asked of
      // the files that hold them. `n/a` for a graph that declares none.
      "global-task-shared": entry(unsharedGlobalTasks, globalTaskFiles.length > 0),
      // `unknown` when there is no role graph: with no roles declared, every
      // skill looks unmodelled and the count would be the whole corpus — a
      // number that says nothing about the corpus and everything about the
      // missing file. Reporting it as a finding would be a wall of noise.
      "consulted-skill-not-performed": entry(consultedButPerformed, consulted.size > 0),
      "skill-in-role-or-process": graph
        ? entry(unmodelled)
        : { result: "unknown" as KgResult, findings: [{ where: "—", detail: "no role graph declared." }] },
      // A REMOTE DECLARATION IS NOT RESOLUTION — measured 2026-09-19, bean `nup0`.
      //
      // This criterion used to accept an entry that any file under
      // `skills/remote-packages/` named, on the reading that "is this a real skill
      // somewhere" is the manifest's question, distinct from "can this instance
      // serve it". The distinction is right. What is missing is that nothing here
      // implements the "somewhere": `shallow-clone` exists only as a Zod enum
      // value, `src/tools/skill-fetch.ts` and `scripts/generate-registry.ts`
      // contain no mention of `remote-packages/` at all, and the single consumer —
      // `scripts/generate-docs.ts` — reads those files solely for Docker
      // requirements, which is what `schemas/kg/skill-package.ts` documents them as.
      // (That consumer was retired to `fsh-guts/scripts/` on 2026-09-20,
      // having never been invoked in any commit since the root commit — bean
      // `folio-assistant-3w0i`. The reading below only gets stronger.)
      //
      // So an entry resolvable only that way publishes a registry name that
      // `skill_fetch` answers "not found" for, which is exactly the defect this
      // criterion is `critical` about.
      //
      // The allowance existed to stop this criterion demanding the deletion of
      // three `authoring-math` entries. Those three were deleted two hours later
      // by a session that had not seen it, and — measured above — deleting them
      // was RIGHT. The allowance was protecting the wrong answer.
      //
      // `remotePackageSkills` stays, to CLASSIFY the finding rather than excuse
      // it. "Declared by a remote package nothing syncs" and "named nowhere at
      // all" have different remedies, and a finding that does not say which is one
      // somebody has to measure again.
      // A downstream tool with no declaration (bean `fq5u`). The family's
      // per-Tool verdict is `tool-downstream-fresh`, which generalises what
      // `lsi-index-fresh` judged here for LSI alone. The entry is built there,
      // not by `entry()`, because run records that are not in the checkout
      // make it `unknown` rather than a pass (bean `oq1j`).
      "downstream-tool-declared": undeclaredDownstreamEntry(tools(), AUDITOR_ROOT, VERIFIERS.map((v) => ({ id: v.id, tool: v.tool }))),
      "manifest-skill-exists": (() => {
        const remote = remotePackageSkills(root);
        return entry(
          manifestEntries()
            .filter((e) => !skills.has(e.skill))
            .map((e) => ({
              where: `${e.pkg}/${e.skill}`,
              detail: remote.has(e.skill)
                ? `skills/${e.pkg}/package-manifest.json names "${e.skill}", which this instance holds no ` +
                  `body for. A file under skills/remote-packages/ declares it, but nothing in this ` +
                  `repository syncs or serves a remote package — neither skill_fetch nor the registry ` +
                  `reads that directory — so the entry publishes a name that cannot be fetched. Implement ` +
                  `the sync or drop the entry; the declaration alone is not enough.`
                : `skills/${e.pkg}/package-manifest.json names "${e.skill}", which resolves to no skill here ` +
                  `and is declared by no remote package.`,
            })),
        );
      })(),
      // The other half of the same measurement, and the one the owner asked to
      // FAIL rather than be explained. `manifest-skill-exists` above asks
      // whether a MANIFEST names something unresolvable; this asks whether a
      // REMOTE PACKAGE declares something this layer cannot serve — five
      // names today, across two wrappers that both claim a weekly shallow-clone
      // nothing performs. Bean `wlqd`.
      //
      // Read from the wrapper files rather than from `remotePackageSkills`'s
      // flattened set, because a finding has to name WHICH wrapper declares it:
      // the two have different owners and different remedies.
      "remote-skill-is-servable": entry(
        remotePackageDeclarations(root)
          .filter((d) => !skills.has(d.skill))
          .map((d) => ({
            where: `${d.file}/${d.skill}`,
            detail:
              `skills/remote-packages/${d.file} declares "${d.skill}", which this instance holds no body ` +
              `for and cannot serve — skill_fetch does not read that directory and the generated registry ` +
              `does not carry it. The wrapper declares sync ${JSON.stringify(d.sync ?? null)}, and nothing ` +
              `performs it. Implement the sync (a platform capability change: GitHub issue + CRDM workflow ` +
              `first), or drop the declaration so the name stops being published.`,
          })),
      ),
      // Without a role graph there is nothing to resolve against, and reporting
      // every actor's roles as dangling would be a wall of false findings.
      "actor-roles-resolve": graph
        ? entry(badActorRoles)
        : { result: "unknown", findings: [{ where: "—", detail: "no role graph to resolve actor roles against." }] },
      "actor-capabilities-resolve": entry(badCaps),
      "actor-permissions-resolve": entry(badPerms),
      "actor-is-not-a-role": entry(roleish),
      "actor-fact-has-consumer": evaluateActorFactConsumers({
        actors,
        processes,
        workflowFiles: workflowFiles(root, corpusScopeFor(root)),
        policiesDir: POLICY_DIR,
      }),
      // A story points at its role (#1168); a story whose role is not declared
      // is told as nobody. Only this layer's roles are judged — see
      // `danglingStoryRoles`.
      "story-role-resolves": !stories
        ? entry([], false)
        : graph
        ? entry(
            danglingStoryRoles(stories, graph).map((st) => ({
              where: st.id,
              detail: `user story "${st.id}" is told as role "${st.role.role}", which the role graph does not declare.`,
            })),
          )
        : { result: "unknown", findings: [{ where: "—", detail: "no role graph to resolve story roles against." }] },
      // A skill or capability claiming a requirement statement that is not
      // declared (#1168, B3). The statement names no satisfier, so this is
      // the only place a mistyped claim can be caught.
      "satisfies-resolves": entry(badSatisfies),
      "skill-graph-typologies-resolve": entry(unknownSkillGraphTypologies()),
      "skill-contract-resolves": entry(brokenSkillContracts()),
      ...testRunCriteria(skills),
      ...testPlanCriteria(actors),
      "arrow-direction": arrowDirection(),
      "prose-names-resolve": proseNamesResolve(),
      "skill-contract-claimed": entry(unclaimedSkillContracts()),
      "nested-instance-audited": entry(unreadNestedInstances()),
      // A content layer holding code (bean `eayu`) — see content-holds-code.ts.
      "content-instance-holds-code": contentInstanceHoldsCode(),
      // Generic orphan detector across declared graph kinds (bean folio-assistant-9mmu).
      "orphan-subject-resolves": orphanSubjectResolves(root, { repoRoot: REPO_ROOT }),
      "work-traceability-audit": evaluateTraceabilityAudit({ root }),
      "lake-target-lean-resolution": auditLakeTargetLeanResolution(root),
    },
  );
}

// ── Sidecar IO ──────────────────────────────────────────────────

function sidecarPath(r: KgQaReport): string {
  // ANY subject that records its own path resolves its directory from THAT,
  // not from a table keyed on its kind.
  //
  // This was skill-only, for a reason that turned out to be general: skills
  // live under several packages, so one directory per kind would collide two
  // packages' same-named skills into one sidecar. Processes have exactly that
  // shape the moment a layer declares more than one knowledge-graph
  // directory — `bootstrap/processes/` and `crdm/workflows/` can each hold a
  // `review.bpmn`, and a kind-keyed table sends both to one file, so one
  // silently overwrites the other's findings.
  //
  // So the table below is now what its own comment already called it for
  // skills: a FALLBACK, for subjects that carry no path — a role, a
  // requirement, the graph itself.
  const dirFor: Record<KgSubjectKind, string> = {
    process: WORKFLOW_DIR,
    decision: DECISION_DIR,
    role: SCENARIO_DIR,
    requirement: join(KG_ROOT, "requirements"),
    skill: KG_ROOT,
    graph: SCENARIO_DIR,
    tool: TOOLS_DIR,
    folio: FOLIO_DIR,
    schema: SCHEMAS_DIR,
  };
  const stem = r.subject.path ? basename(r.subject.path).replace(/\.(bpmn|dmn|json|md)$/, "") : r.subject.id;
  const name = r.subject.kind === "role" || r.subject.kind === "requirement" ? r.subject.id : stem;
  const dir = r.subject.path ? dirname(join(root, r.subject.path)) : dirFor[r.subject.kind];
  return kgQaSidecarPath(root, dir, name, KG_QA_TREE);
}

/** The attestation store file for a report: its sidecar's mirror under `KG_ATT_TREE`. */
function attestationPath(r: KgQaReport): string {
  return attestationPathFor(sidecarPath(r), KG_QA_TREE, ATT_HOME.root, "kg-qa", KG_QA_SIDECAR_SUFFIX);
}

function serialise(r: KgQaReport): string {
  return `${JSON.stringify(r, null, 2)}\n`;
}

// ── Main ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const check = args.includes("--check");
const strict = args.includes("--strict");
const asJson = args.includes("--json");
/**
 * Create the attestation store (the `attestations` directory) when it is
 * absent, even with nothing to put in it. No longer required: since owner
 * ruling 2 (2026-10-01) an absent store is `absent`, not `unknown`, and the
 * first save creates it, moving whatever judgements the prior sidecars still
 * carry. C4's loss came from re-baselining over judgements nobody read; a
 * first save that READS the prior sidecar and writes what it holds to the
 * store first cannot do that. Kept so scripts that pass it keep working.
 */
const initAttestations = args.includes("--init-attestations");
if (initAttestations && check) {
  console.error("--init-attestations starts a store; --check writes nothing. Run them separately.");
  process.exit(2);
}
/**
 * Judge mode's prelude (bean `oqe3`): an unknown flag is a usage error — a
 * misspelt `--chek` would otherwise run the WRITER — and `--against <ref>`
 * names the `qa-reports` baseline new findings are split from.
 */
const JUDGE_GATE = strict ? "kg:audit:strict" : "kg:audit:check";
let against: string | undefined;
if (check) {
  const usage = judgeUsage(JUDGE_GATE, args, ["--instance", "--strict", "--json", "--against"]);
  if (usage !== undefined) process.exit(usage);
  const a = againstOrUsage(JUDGE_GATE, args);
  if (a.exit !== undefined) process.exit(a.exit);
  against = a.against;
}

const auditorHash = sha256(readFileSync(join(TOOLS_ROOT, "scripts", "kg-audit.ts"), "utf-8"));
const skills = knownSkills(root, corpusScopeFor(root));

/**
 * The skills a REFERENCE in this layer may resolve to: its own, plus every
 * layer it declares `needs` on, transitively.
 *
 * ## Why resolution is wider than ownership
 *
 * A skill ref names a body an activity's performer must read, and a body in a
 * DEPENDENCY is one this layer may read — that is what depending on it
 * means. Resolving refs against `knownSkills(root)` alone made every such ref
 * dangle: measured 2026-09-27, a DAK base layer reported `skill-ref-resolves`
 * **fail (9)** on nine activities of `diig-investment-path.bpmn`, all naming
 * the one skill `methodology-adoption`, which lives at
 * `cat-harness/skills/process/process-core/methodology-adoption.md` — four layers down
 * its own declared `needs` chain. Nine criticals against a diagram that is
 * correct.
 *
 * The auditor's own run already knew: `test/results/kg-qa/_external/<instance>/`
 * recorded `skill-ref-resolves` **pass (0)** for that same diagram, because from
 * here the skill is local. So the two runs disagreed about one file, and the
 * instance-scoped one was wrong. (That `_external/` copy was itself the
 * defect's enabler — two verdicts about one subject — and was deleted with the
 * other seven on 2026-10-01, Q-A PR 4; the owner's run now holds the only one.)
 *
 * ## This is the FIFTH cross-instance defect, and the only DOWNWARD one
 *
 * The other four leaked things a layer should not see (a repo's actors, its
 * capabilities, 119 phantom tool sidecars, 23 skills from `.claude/skills/`) and
 * were fixed by NARROWING. This one is the opposite polarity: a layer could
 * not see what is legitimately BELOW it. A narrowing fix cannot find it, which
 * is why it survived all four.
 *
 * ## Ownership stays narrow, deliberately
 *
 * `manifest-skill-exists` and `remote-skill-is-servable` keep reading
 * {@link skills}, because both ask whether THIS layer holds a BODY for a
 * name it publishes. A dependency's skill is not this layer's to serve, so
 * widening those would excuse exactly the defect they exist to catch. Same
 * split, and the same ruling (`pve3` — *"not in my overlay is not does not
 * exist"*), as `satisfiableSkills` in `check-tools.ts`: resolution widens,
 * coverage does not.
 *
 * ## `orderedDependencies` rather than a closure written here
 *
 * It already walks `needs` transitively — measured: a DAK base layer yields
 * `bootstrap`, `cat-harness`, the content core and the FHIR IG harness, its whole
 * chain; `cat-harness` yields `bootstrap` alone. A second walker would be a
 * second answer to one question, which is the `j79e` defect.
 */
const resolvableSkills: Set<string> = (() => {
  const out = new Set(skills);
  for (const dep of orderedDependencies(root)) {
    for (const s of knownSkills(dep.rootPath)) out.add(s);
  }
  return out;
})();

/**
 * Has this layer declared where it sits in the stack?
 *
 * `needs` is OPTIONAL with a documented THIRD STATE: an absent value is
 * UNDETERMINED, never `[]` — `[]` is an assertion that this layer is the
 * floor, absent is nobody having said (`schemas/kg/cat-harness.ts`, `needs`;
 * `schemas/kg/layer-direction.ts` refuses the same collapse for edges).
 *
 * Read straight from the declaration rather than inferred from
 * {@link resolvableSkills} being no wider than {@link skills}, because
 * `dependenciesFromNeeds` collapses the two states with `?? []` — a layer
 * that declares nothing and one that declares the floor both derive zero
 * dependencies, and only one of them has said so.
 *
 * MEASURED 2026-09-27: **5 of 16** layers here declare no `needs` —
 * `agent-skills`, the formal-math content layer, `large-datasets`, the IRIS
 * replica, `who-style-guide`. So this is a third of the subject, not a hypothetical.
 */
const layeringUndetermined = ((): boolean => {
  try {
    return readDeclaration(root)?.needs === undefined;
  } catch {
    // An unreadable declaration is not this script's to diagnose
    // (`check:declaration-filename` reports it), but it is certainly not a
    // DECLARED layering — so undetermined, never "needs nothing".
    return true;
  }
})();

/**
 * Can a ref that is not in this layer's own set be judged at all?
 *
 * Monotone, and that is the whole point: a closure only ever ADDS skills, so a
 * ref already in {@link skills} resolves no matter what the layering turns out
 * to be. Only a ref that MISSES the own set depends on it — and then an
 * undeclared layering makes the answer unknown rather than a failure.
 *
 * Without this split, the IRIS replica (1 own skill) and `large-datasets` (3) would
 * have their true passes converted into `unknown`, which is a report getting
 * worse while looking more careful.
 */
const refUnjudgeable = (ref: string): boolean =>
  layeringUndetermined && !resolvableSkills.has(ref);
// The CHECKOUT's actors on the platform's own run: a dependent may extend an
// actor by id with the roles and capabilities it takes on there (placement
// PR0b). On `--instance`, the actors THAT layer may name: the platform's,
// every layer it needs, and its own. Reading the platform's alone reported
// a downstream's own actors (the IHE ITI VHL Sharer, Receiver) as undeclared
// on every requirement and role that names them.
//
// Their grants come from the same layers' `policies/`: an actor a dependent
// adds keeps its ODRL grants in that dependent's own policies, beside it.
const PLATFORM_ROOT = ACTOR_DIR ? findInstanceRoot(ACTOR_DIR) : undefined;
// declared-path-literal: the convention fallback, at the call site, as POLICY_DIR.
const PLATFORM_POLICY_DIR = PLATFORM_ROOT ? ownDirectoryById(PLATFORM_ROOT, "policies", "policies") : POLICY_DIR;
/** Which layers the actors are read over; their capabilities are read over the same. */
const ACTOR_SCOPE: ActorScope = corpusScopeFor(root) === "checkout" ? "checkout" : INSTANCE_RUN ? "needed" : "own";
const actors =
  ACTOR_SCOPE === "checkout"
    ? checkoutActors(root, ACTOR_DIR, policyGrants(checkoutPolicies(root, POLICY_DIR)))
    : ACTOR_SCOPE === "needed"
      ? neededActors(root, ACTOR_DIR, policyGrants(neededPolicies(root, PLATFORM_POLICY_DIR)))
      : readActors(ACTOR_DIR, policyGrants(readPolicies(POLICY_DIR)));

let graph: RoleGraph | undefined;
let graphError: string | undefined;
/**
 * WHERE the role graph was actually found, for the findings that cite it.
 *
 * Not a constant: `scenarios/` is the convention since 2026-09-21 and
 * `skills/roles/` is what an unmigrated layer still has, so a message
 * naming either unconditionally is wrong for half the corpus — and a
 * "roles.json is missing" pointing at the path the reader does not use is
 * worse than no path at all.
 */
let roleGraphPath = "";
/**
 * The ids of the roles THIS layer's own role graph declares.
 *
 * The checkout overlay above also brings in the roles a higher layer owns
 * outright (a DAK base layer's `l1-extraction-reviewer`, owner ruling 3b,
 * 2026-10-12). Those resolve here, but they are that layer's subjects:
 * its own `--instance` run audits them. Emitting them again from the
 * platform's run is the duplicated subject `instance-graph-isolation.test.ts`
 * forbids, and what `resolution-across-needs.test.ts` ("the audit's role
 * SUBJECTS are the instance's own") pins: resolution widens, subjecthood
 * does not.
 */
const ownRoleIds = new Set<string>();
try {
  // declared-path-literal: the convention fallback, at the call site. The
  // role graph moved out of the skills tree on 2026-09-21 and is a declared
  // directory of its own; `KG_ROOT` is the second branch for a layer
  // that has not migrated.
  graph = readRoleGraph(SCENARIO_DIR);
  roleGraphPath = join(SCENARIO_DIR, "roles.json");
  if (!graph) {
    graph = readRoleGraph(KG_ROOT);
    if (graph) roleGraphPath = join(KG_ROOT, "roles", "roles.json");
  }
  // The roles this layer declares itself, before any overlay: the role
  // SUBJECTS of this run (see `ownRoleIds` below).
  for (const r of graph?.roles ?? []) ownRoleIds.add(r.id);
  // Dependents' extensions, by id, on the platform's own run (placement PR0b).
  // Identical to the graph above while no dependent extends a role.
  if (graph && corpusScopeFor(root) === "checkout") graph = checkoutRoleGraph(root, graph)?.graph ?? graph;
} catch (e) {
  graphError = e instanceof Error ? e.message : String(e);
}
if (graphError) {
  console.error(`Could not read the role graph: ${graphError}`);
  console.error("This is NOT a pass. Nothing was audited against roles.");
  process.exit(2);
}

/**
 * The role IDS a REFERENCE in this layer may resolve to: its own graph's,
 * plus every layer it declares `needs` on, transitively.
 *
 * ## The same defect as {@link resolvableSkills}, one graph over
 *
 * Measured 2026-09-27, after the skill half landed: 11 of 13 nested layers
 * reported ZERO criticals, and the two that did not — a DAK base layer and
 * the content core — reported `role-ref-resolves` and
 * `raci-role-resolves`. Their diagrams name `business-analyst`,
 * `programme-manager` and `deep-researcher`, and **all three are defined in
 * `cat-harness/scenarios/roles.json`**, a transitive dependency of both. So
 * the refs are legitimate and the findings were not.
 *
 * ## IDS, not the graph — and that is the whole design
 *
 * Overlaying the `RoleGraph` OBJECT was considered and rejected on a
 * measurement. The audit emits one SUBJECT per role in the graph (the default
 * run reports "48 roles"), so an overlay would add bootstrap's four roles to
 * cat-harness's results as four new sidecars — for roles bootstrap's own run
 * already audits. That duplicates a dependency's subjects into its dependent,
 * which is the rule `instance-graph-isolation.test.ts` guards and this file's
 * own `root` docblock states: *per-instance means a separate RUN, not a wider
 * walk*.
 *
 * So resolution widens and SUBJECTHOOD does not — the identical `pve3` split
 * {@link resolvableSkills} applies. A set of ids answers "does this ref name
 * something that exists?" and cannot answer anything else, which is exactly
 * the question the two reference criteria ask.
 *
 * The five criteria that need role OBJECTS — `lane-binds-role`,
 * `role-carries-activity-skill`, `activity-fulfilment-kind` and the two RACI
 * shape checks — stay `unknown` for a layer with no graph of its own,
 * because judging carriage requires the definition and this layer does not
 * hold it. Their message is corrected rather than their verdict: saying only
 * "no role graph declared at scenarios/roles.json" reads as "these roles do
 * not exist", when they do, one layer down.
 */
const resolvableRoleIds: Set<string> = (() => {
  const out = new Set<string>();
  const add = (g: RoleGraph | undefined): void => {
    for (const r of g?.roles ?? []) out.add(r.id);
  };
  // THIS LAYER'S OWN ROLES FIRST, and the omission was measured rather than
  // reasoned about: seeded from dependencies alone, cat-harness resolved refs
  // against bootstrap's 4 roles and none of its own 48, so the default run went
  // from 201 failures to 273. `resolvableSkills` seeds `new Set(skills)` for
  // exactly this reason; a closure must CONTAIN the layer it is the closure
  // of. That is why this is declared below the graph load rather than beside
  // `resolvableSkills` — it needs `graph`, which is read later.
  add(graph);
  for (const dep of orderedDependencies(root)) {
    // declared-path-literal: the convention fallback, at the call site, exactly
    // as for `SCENARIO_DIR` and `KG_ROOT` above — `ownDirectoryById` reads the
    // DEPENDENCY's own declaration first, so a layer that declares its
    // scenarios or skills elsewhere is honoured; these two strings are the ids
    // asked for and the conventional directory to fall back on when it declares
    // neither. Both spellings are tried for the reason the own load does:
    // `scenarios/` is the convention since 2026-09-21 and `skills/roles/` is
    // what an unmigrated layer still has, and a dependency may be either.
    try {
      add(
        readRoleGraph(ownDirectoryById(dep.rootPath, "scenarios", "scenarios")) ??
          readRoleGraph(ownDirectoryById(dep.rootPath, "skills", "skills")),
      );
    } catch {
      // A dependency's unreadable role graph is not this run's to diagnose —
      // that layer's OWN audit reports it, and exiting here would make one
      // broken dependency block every dependent's audit.
    }
  }
  return out;
})();


const processes = await loadProcesses();
const reports: KgQaReport[] = [];
const processIds = new Set(processes.flatMap((p) => (p.model ? [p.model.id] : [])));
const processStems = new Set(processes.flatMap((p) => (p.model ? [basename(p.file, ".bpmn")] : [])));
const docs = docsSurface();
const repoProcesses = loadRepoProcesses(REPO_ROOT);
for (const p of processes) reports.push(await auditProcess(p, graph, skills, processIds, processStems, docs, repoProcesses));
reports.push(...(await auditDecisions(processes)));
const storiesPath = join(SCENARIO_DIR, USER_STORIES_FILENAME);
let stories: UserStoryGraph | undefined;
try {
  stories = readUserStories(SCENARIO_DIR);
} catch (e) {
  console.error(`Could not read the user stories: ${e instanceof Error ? e.message : String(e)}`);
  console.error("This is NOT a pass. Nothing was audited against stories.");
  process.exit(2);
}
if (graph) {
  reports.push(...auditRoles(graph, roleGraphPath, processes, actors, skills, stories, storiesPath, ownRoleIds));
}
const requirements = readRequirements();
const satisfiers = readSatisfiers();
reports.push(...auditRequirements(requirements, actors, satisfiers));
reports.push(...auditSkills());
reports.push(auditGraph(graph, processes, actors, skills, stories, danglingSatisfies(requirements, satisfiers), globalTaskSharedFindings(await Promise.all(globalTaskFiles.map(loadGlobalTasks)), processes, root)));
reports.push(...auditTools(INSTANCE_RUN ? root : undefined));
reports.push(...auditFolioBlocks(root));

/**
 * Drop every subject ANOTHER layer owns — it audits that subject itself.
 *
 * The default run walks the CHECKOUT (`corpusScopeFor`), so it loads
 * a DAK base layer's, large-datasets' and the content core's diagrams beside its
 * own. Loading them is right: a call activity here may name one, and the
 * graph-level criteria need the whole corpus. Writing a VERDICT about them is
 * not — each owner's `kg:audit:all` run already writes one under its own
 * `test/results/kg-qa/`, and until 2026-10-01 this run wrote a second under
 * `_external/`. Eight duplicates, deleted with the owner's confirmation
 * (Q-A PR 4, epic `7x5n`); `kgQaSidecarPath` now refuses the path, so this
 * filter is what keeps the run from throwing rather than a courtesy.
 *
 * A subject outside this layer that NO checkout layer owns is refused
 * loudly: dropping it would be a clean run over nothing (`dh4f`), and giving
 * it a path is what `_external/` was.
 */
const ownership = partitionBySubjectOwner(reports, root, layerRootsIn(checkoutRootFor(root)));
if (ownership.unowned.length > 0) {
  console.error(`${ownership.unowned.length} subject(s) lie outside ${root} and no instance in the checkout owns them:`);
  for (const r of ownership.unowned) console.error(`  · ${r.subject.kind}:${r.subject.id}  ${r.subject.path}`);
  console.error("This is NOT a pass. Nothing was written; declare the owning instance, or stop discovering the subject.");
  process.exit(2);
}
reports.splice(0, reports.length, ...ownership.kept);
const ownerAudited = ownership.skipped.length;

// Write or compare.
//
// THE MANIFEST IS ONE FILE, AND THAT IS THE POINT. The auditor's hash used to
// be copied into every sidecar, where it could not differ between files —
// `auditorHash` is computed once above and there is no subset mode — so the
// copies were 218 restatements of one fact. Measured 2026-09-19: one added
// comment line in this script rewrote 218 sidecars with no verdict changed,
// which is what made two concurrent branches conflict by construction.
const stale: string[] = [];
/** Committed attestation files this run would rewrite — gated in judge mode (bean `oqe3`). */
const staleAttestations: string[] = [];

const manifest: KgQaManifest = {
  $schema: KG_QA_MANIFEST_SCHEMA,
  auditor: {
    script: "scripts/kg-audit.ts",
    script_hash: auditorHash,
    engine_version: ENGINE_VERSION,
  },
};
const manifestPath = writePathOf(
  QA_HOME.by === "hosted" ? join(QA_HOME.root, "kg-qa.manifest.json") : join(root, KG_QA_MANIFEST_PATH),
);
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
if (check) {
  const current = existsSync(manifestPath) ? readFileSync(manifestPath, "utf-8") : undefined;
  if (current !== manifestText) stale.push(relative(root, manifestPath));
} else {
  mkdirSync(join(manifestPath, ".."), { recursive: true });
  writeFileSync(manifestPath, manifestText);
}

/**
 * A sidecar whose subject MOVED follows it, instead of dying in place.
 *
 * Bean `lps0` asked for this and #760 walked straight into it: moving
 * `corpus-grep` from `src/skills/` to `skills/folio-core/` left its verdict
 * stranded at the old path, where the sweep below correctly reported it as
 * auditing a file that is not there. A verdict that has to be re-derived on
 * every relocation is a verdict nobody keeps.
 *
 * ## Why this is not the deletion the sweep refuses
 *
 * The sweep's own rule — REPORTED, NEVER DELETED — exists because an orphan
 * can mean the subject is temporarily UNDISCOVERED rather than gone, and
 * deleting on that evidence destroys a verdict to hide a declaration gap.
 * Nothing here deletes. A relocation PRESERVES the artefact and its history;
 * it moves the file to where its subject now lives, and an orphan that does
 * not match a moved subject is left exactly where it is, to be reported.
 *
 * ## The three conditions, and why each is required
 *
 * 1. `subjectExists === false` — CONFIRMED gone, never `undefined`. The third
 *    state is "could not read the sidecar", and a sidecar whose identity could
 *    not be read is precisely the one that must not be moved on a guess.
 * 2. The identity is `kind` + `id`, not the path and not the basename. The
 *    path is what changed; two packages can hold a same-named skill, so a
 *    basename match would move one package's verdict onto another's subject.
 * 3. Exactly ONE orphan and exactly ONE unwritten target per identity. Any
 *    ambiguity is left alone and reported: a verdict moved onto the wrong
 *    subject is worse than an orphan, because an orphan announces itself and
 *    a misfiled verdict reads as healthy.
 */
interface Relocation {
  from: string;
  to: string;
  identity: string;
}

function relocateSidecars(
  root: string,
  targets: ReadonlyMap<string, string>,
): Relocation[] {
  const orphans = sweepOrphans(root, new Set(targets.values()), KG_QA_TREE);
  const byIdentity = new Map<string, OrphanSidecar[]>();
  for (const o of orphans) {
    // Condition 1 and 2: confirmed gone, and carrying an identity to match on.
    if (o.subjectExists !== false || !o.kind || !o.id) continue;
    const key = `${o.kind}:${o.id}`;
    (byIdentity.get(key) ?? byIdentity.set(key, []).get(key)!).push(o);
  }

  const moved: Relocation[] = [];
  for (const [key, rows] of byIdentity) {
    const dest = targets.get(key);
    // Condition 3: one orphan, one destination, and nothing already there.
    if (rows.length !== 1 || dest === undefined) continue;
    if (existsSync(dest)) continue;
    const from = join(root, rows[0]!.sidecar);
    if (!existsSync(from)) continue;
    mkdirSync(join(dest, ".."), { recursive: true });
    renameSync(from, dest);
    moved.push({ from: rows[0]!.sidecar, to: relative(root, dest), identity: key });
  }
  return moved;
}

// Targets FIRST, so a relocation can run before anything is written: once a
// fresh sidecar exists at the new path there is nothing left to move, and the
// old one is an orphan forever.
const targets = new Map<string, string>();
for (const r of reports) {
  if (r.subject.kind && r.subject.id) targets.set(`${r.subject.kind}:${r.subject.id}`, sidecarPath(r));
}
if (!check) {
  const moved = relocateSidecars(root, targets);
  for (const m of moved) {
    console.log(`  → moved ${m.from}\n      to ${m.to}  (${m.identity} relocated)`);
    // The judgement follows its subject the same way, under the same three
    // conditions `relocateSidecars` already checked — and only onto a vacant path.
    const from = attestationPathFor(join(root, m.from), KG_QA_TREE, ATT_HOME.root, "kg-qa", KG_QA_SIDECAR_SUFFIX);
    const to = attestationPathFor(join(root, m.to), KG_QA_TREE, ATT_HOME.root, "kg-qa", KG_QA_SIDECAR_SUFFIX);
    // A mounted layer's committed store is never moved (see ATT_IN_MOUNT).
    if (!ATT_IN_MOUNT && existsSync(from) && !existsSync(to)) {
      mkdirSync(dirname(to), { recursive: true });
      renameSync(from, to);
      console.log(`  → moved ${relative(root, from)}\n      to ${relative(root, to)}  (its attestations)`);
    }
  }
}
if (initAttestations && !check && !ATT_IN_MOUNT && !existsSync(ATT_STORE)) {
  mkdirSync(ATT_STORE, { recursive: true });
  console.log(`  → started the attestation store at ${relative(root, ATT_STORE)} — declare it as an \`attestations\` directory`);
}

/**
 * The judgements this run carries forward, per report. `undefined` for a half
 * means its store could not be read (`corrupt` / `unknown`), and then NOTHING
 * is written for that subject — a write would replace a judgement nobody read.
 */
const judgements = new Map<KgQaReport, { pairs: PairAttestation[] | undefined; reviews: VoiceReview[] | undefined }>();
const judgementsOf = (r: KgQaReport) =>
  judgements.get(r) ?? judgements.set(r, { pairs: [], reviews: [] }).get(r)!;

// ── Declared prose ↔ code pairs (bean `cuxx`, issue #1042).
//
// Evaluated here rather than inside auditProcess/auditSkills because it is the
// one criterion that READS a prior judgement: its baseline is carried across
// runs, the way a block-qa reviewer entry is. The prior comes from the
// attestation STORE, not the sidecar (bean `2gst`): a sidecar is derived and
// leaves main, and an absent one used to re-baseline every pair (C4, 13 → 0).
// Done before the write loop so `--check` regenerates the same text the writer would.
{
  // `REPO_ROOT`, not `resolve(root, "..")` — see its declaration (bean `pgzn`).
  const repoRoot = REPO_ROOT;
  const scripts = rootScripts(repoRoot);
  for (const r of reports) {
    if (r.subject.kind !== "process" && r.subject.kind !== "skill") continue;
    const pairs = discoverPairs(r.subject, root, repoRoot);
    // On a store miss (or no store yet) the prior sidecar's own attestations
    // are read instead, and moved into the store below (owner ruling 2).
    const { entry: e, attestations } = evaluatePairsFrom(pairs, readAttestations(attestationPath(r), ATT_STORE, sidecarPath(r)), repoRoot);
    r.criteria[PAIR_CRITERION] = e;
    // Stage A (bean `ca4a`): what the prose says about the code, where it can be checked.
    r.criteria["prose-claims-resolve"] = claimsEntry(pairs.flatMap((p) => judgePair(repoRoot, p, scripts)));
    r.totals = tally(r.criteria);
    judgementsOf(r).pairs = attestations;
  }
}

// ── Skills reviewed against the voices that judge skills (bean `rkqp`).
//
// The same shape as the pairs above: it READS the attestation store, because a
// review is carried across runs, so it runs before the write loop too.
{
  const voices = skillVoices(resolve(root, ".."));
  for (const r of reports) {
    if (r.subject.kind !== "skill" || !r.subject.path) continue;
    const { entry: e, reviews } = evaluateVoiceReviewsFrom(join(root, r.subject.path), readVoiceReviews(attestationPath(r), ATT_STORE, sidecarPath(r)), voices);
    r.criteria[VOICE_REVIEW_CRITERION] = e;
    r.totals = tally(r.criteria);
    judgementsOf(r).reviews = reviews;
  }
}

// ── The judgements, to the attestation store (bean `2gst`).
//
// Written only where both halves were read (hit, miss or absent). A subject
// whose computed set is EMPTY while a file exists is left as it is and
// reported: emptying it would delete judgements, and that is a person's call.
//
// Owner ruling 2 (2026-10-01): where the store has no entry for a subject —
// or there is no store yet — the judgements its PRIOR sidecar still carries
// are moved here as this run saves, and the sidecar written after is clean.
// Every moved entry lands in the store: one the evaluation above did not
// carry forward (a pair no longer declared) is kept verbatim rather than
// dropped with the sidecar's copy. A prior sidecar that will not parse while
// the store has no entry may be holding judgements, so that subject is
// UNKNOWN: neither file is written, and the run fails.
//
// The store is written BEFORE the sidecars, so a run that stops between the
// two leaves the judgements in both places, never in neither.
const attWritten = new Set<string>();
const attKept: string[] = [];
const attUnknown = new Set<KgQaReport>();
let attMoved = 0;
for (const r of reports) {
  const p = attestationPath(r);
  attWritten.add(resolve(p));
  const read = readAttestationFile(p, ATT_STORE);
  const prior = read.state === "miss" || read.state === "absent" ? priorKgJudgements(sidecarPath(r)) : ({ state: "none" } as const);
  if (prior.state === "unknown") {
    attUnknown.add(r);
    console.error(`  ✗ UNKNOWN ${relative(root, sidecarPath(r))}: ${prior.reason}. The store has no entry for it, so neither file is written.`);
    continue;
  }
  const j = judgements.get(r) ?? { pairs: [], reviews: [] };
  if (j.pairs === undefined || j.reviews === undefined) continue;
  let pairs = j.pairs;
  let reviews = j.reviews;
  {
    if (prior.state === "found") {
      attMoved += prior.pair_attestations.length + prior.voice_reviews.length;
      const pairKey = (a: { kind?: unknown; prose?: unknown; code?: unknown }) => `${String(a.kind)}|${String(a.prose)}|${String(a.code)}`;
      const havePairs = new Set(pairs.map(pairKey));
      const haveVoices = new Set(reviews.map((v) => v.voice));
      pairs = [...pairs, ...(prior.pair_attestations as PairAttestation[]).filter((a) => !havePairs.has(pairKey(a)))];
      reviews = [...reviews, ...(prior.voice_reviews as VoiceReview[]).filter((v) => !haveVoices.has(v.voice))];
    }
  }
  const file: KgAttestations = { $schema: QA_ATTESTATIONS_SCHEMA, family: "kg-qa", subject: r.subject };
  if (pairs.length) file.pair_attestations = pairs;
  if (reviews.length) file.voice_reviews = reviews;
  if (!file.pair_attestations && !file.voice_reviews) {
    if (existsSync(p)) attKept.push(relative(root, p));
    continue;
  }
  const text = serialiseAttestations(file);
  if (check) {
    // The attestation store is COMMITTED content on main (ruling D2 (a)), not
    // a derived file leaving it — so a store this run would rewrite is still
    // a finding in judge mode (bean `oqe3`), unlike a derived sidecar.
    const current = existsSync(p) ? readFileSync(p, "utf-8") : undefined;
    // A MOUNTED layer's store is its own repository's to judge: reported, not failed (see ATT_IN_MOUNT).
    if (current !== text) (ATT_IN_MOUNT ? attLeftInMount : staleAttestations).push(relative(root, p));
  } else if (ATT_IN_MOUNT) {
    const current = existsSync(p) ? readFileSync(p, "utf-8") : undefined;
    if (current !== text) attLeftInMount.push(relative(root, p));
  } else {
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, text);
  }
}
// To STDERR: `--json` owns stdout (its report array is parsed whole), and
// this advisory is printed before the judge redirects console.log.
if (attLeftInMount.length > 0) {
  console.error(
    `\n  · ${attLeftInMount.length} committed attestation file(s) of a MOUNTED layer would change; left as pinned ` +
      "(a mount is read-only). Run `bun run cat kg:audit:all` in that layer's own repository to rewrite them:",
  );
  for (const a of attLeftInMount) console.error(`    ${a}`);
}
if (attMoved > 0) {
  console.log(
    `  ${check ? "would move" : "→ moved"} ${attMoved} judgement(s) from prior kg-qa sidecars into the attestation store ` +
      `(${relative(root, ATT_STORE)}) — owner ruling 2: a first save moves them`,
  );
}

const written = new Set<string>();
for (const r of reports) {
  const p = sidecarPath(r);
  written.add(resolve(p));
  // Never overwrite a sidecar whose judgements could not be moved.
  if (attUnknown.has(r)) continue;
  if (check) {
    if (!existsSync(p) || readFileSync(p, "utf-8") !== serialise(withPriorAdversarialReviews(r, p))) {
      stale.push(relative(root, p));
    }
  } else {
    const text = serialise(withPriorAdversarialReviews(r, p));
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, text);
  }
}
if (attKept.length > 0) {
  console.error(`\n  ${attKept.length} attestation file(s) left untouched: their subject declares no pair or review now.`);
  for (const k of attKept) console.error(`    ${k}`);
  console.error("    Kept, never emptied — removing a judgement is a person's call.");
}

/** Attestation files no report accounts for — the store's half of the orphan sweep below. */
function attestationOrphans(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.name.endsWith(ATTESTATIONS_SUFFIX) && !attWritten.has(resolve(abs))) out.push(relative(root, abs));
    }
  };
  walk(KG_ATT_TREE);
  return out.sort();
}
// NOT JUDGED HERE: an attestation whose subject is in a directory the mount
// that placed this layer left out (`leftOutByMount`: an opt-in sub-graph the
// downstream has switched off, so the whole mount did not lay it down). No
// report covers it because its subject is not in this checkout by consent;
// the layer that switches the sub-graph on judges it. A subject the mount
// took, or a layer no mount placed, is still an orphan and still fails.
const attNotHere: string[] = [];
const attOrphans = attestationOrphans().filter((o) => {
  const subject = mirroredSubjectDir(join(root, o), KG_ATT_TREE, root);
  if (subject === undefined || !leftOutByMount(root, subject)) return true;
  attNotHere.push(o);
  return false;
});
if (attNotHere.length > 0) {
  console.log(
    `\n  · ${attNotHere.length} attestation file(s) not judged here: their subject is in a directory the mount ` +
      "that placed this layer left out (switched off for this checkout); the layer that switches it on judges them.",
  );
}
if (attOrphans.length > 0) {
  console.error(`\n\u2717 ${attOrphans.length} attestation file(s) judge a subject no report covers:`);
  for (const o of attOrphans) {
    const read = readAttestationFile(join(root, o), ATT_STORE);
    console.error(`    ${o}${read.state === "hit" ? "" : `  (${read.state})`}`);
  }
  console.error("  Reported, never deleted — `deletion-requires-confirmation`. It fails `kg:audit:check`.");
}

// ── A SIDECAR NO REPORT ACCOUNTS FOR.
//
// The loop above compares each report against its file. It never looks the
// other way, so a sidecar whose SUBJECT has been renamed or deleted is
// structurally invisible: nothing regenerates it, nothing prunes it, and
// `--check` compares it against nothing.
//
// Measured, bean `3jj9`: `bootstrap/processes/bootstrap.kg-qa.json` sat in
// the tree auditing `bootstrap/processes/bootstrap.bpmn`, a path that does
// not exist — the process had been renamed to `initialize-harness.bpmn`.
// It reported `lane-binds-role: pass` over a file nobody had, while the live
// diagram had no sidecar at all, and `kg:audit:check` exited 0 across both.
// A verdict about a file that is gone is worse than no verdict: it is the
// one a reader trusts.
//
// REPORTED, NEVER DELETED. An orphan can also mean the subject is
// temporarily unreachable — here the real cause is bean `pve3`, the root
// declaring `bootstrap/skills/` but not `bootstrap/processes/`, so the
// process is simply not discovered from this root. Deleting on that
// evidence would destroy a verdict to hide a declaration gap.
// `deletion-requires-confirmation` — the agent reports, a person decides.
const orphans = sweepOrphans(root, written, KG_QA_TREE);
if (orphans.length > 0) {
  const gone = orphans.filter((o) => o.subjectExists === false);
  const present = orphans.filter((o) => o.subjectExists === true);
  const unknown = orphans.filter((o) => o.subjectExists === undefined);
  console.error(`\n\u2717 ${orphans.length} sidecar(s) audit a subject no report covers:`);
  const show = (label: string, rows: OrphanSidecar[], advice: string): void => {
    if (rows.length === 0) return;
    console.error(`\n  ${label} (${rows.length}):`);
    for (const o of rows.sort((a, b) => (a.sidecar < b.sidecar ? -1 : 1))) {
      console.error(`    ${o.sidecar}`);
    }
    console.error(`    ${advice}`);
  };
  show(
    "SUBJECT GONE",
    gone,
    "The audited file is not there. The verdict describes nothing; the sidecar is dead.",
  );
  show(
    "SUBJECT PRESENT, NOT AUDITED",
    present,
    "The file exists and this run did not audit it. Either discovery is wrong, or it\n" +
      "    is excluded on purpose — `isPartOfASkill` excludes a fragment that declares\n" +
      "    `part-of:`, and a sidecar predating that exclusion is stale, not evidence.",
  );
  show(
    "SUBJECT UNREADABLE",
    unknown,
    "The sidecar could not be parsed or names no path, so which case this is could\n" +
      "    not be determined. That is not a pass for it.",
  );
  console.error("\n  Reported, never deleted — `deletion-requires-confirmation`.");
  // And, since 2026-09-20, this FAILS `kg:audit:check`. Reporting without
  // failing is what let twelve of these accumulate: the finding printed `✗` on
  // every run while the gate set announced "53 gates pass", so the only reader
  // who would ever act on it was one already reading the log for another reason.
  //
  // Failing the check does NOT delete anything — the line above still holds, and
  // the remedy is still a person's. What changes is that the remedy cannot be
  // indefinitely deferred in silence.
  console.error("  It fails `kg:audit:check`; removing a dead sidecar is still yours to authorise.");
}

/**
 * Write all of `text` to `fd`, synchronously.
 *
 * One `writeSync` is not enough on a pipe: it returns after filling the pipe's
 * buffer (64 KiB on Linux) and the rest is dropped, so a parent reading
 * `kg-audit --json` got exactly 65536 bytes of a larger report and could not
 * parse it (resolution-across-needs.test.ts, CI run 38696377785). So: loop on
 * the count written, and wait out EAGAIN while the reader drains the pipe.
 */
function writeFullySync(fd: number, text: string): void {
  const buf = Buffer.from(text, "utf-8");
  const pause = new Int32Array(new SharedArrayBuffer(4));
  let off = 0;
  while (off < buf.length) {
    try {
      off += writeSync(fd, buf, off, buf.length - off);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EAGAIN") throw e;
      Atomics.wait(pause, 0, 0, 5);
    }
  }
}

if (asJson) {
  // Written synchronously: the judge below ends in `process.exit`, and a
  // multi-megabyte `console.log` to a PIPE is not flushed by then — the
  // callers that parse this saw a truncated array (bean `oqe3`).
  writeFullySync(1, JSON.stringify({ reports, stale }, null, 2) + "\n");
} else {
  const rank: Record<KgSeverity, number> = { minor: 1, major: 2, critical: 3 };
  const counts: Record<KgResult, number> = { pass: 0, fail: 0, "n/a": 0, unknown: 0 };
  for (const r of reports) for (const k of Object.keys(counts) as KgResult[]) counts[k] += r.totals[k] ?? 0;

  console.log(`Knowledge-graph audit  (${reports.length} subjects, ${skills.size} skills, ${graph?.roles.length ?? 0} roles)\n`);
  console.log(`  pass ${counts.pass}   fail ${counts.fail}   n/a ${counts["n/a"]}   unknown ${counts.unknown}\n`);
  // Said, not silent: a subject left to its owner is still a subject this run
  // saw, and a reader comparing counts across runs needs the difference named.
  if (ownerAudited > 0) {
    console.log(`  ${ownerAudited} subject(s) another instance owns were left to that instance's own audit.\n`);
  }
  // The scope line, printed only when it has something to say. A run at the
  // auditor's own root suppresses nothing, so a `0 suppressed` line there would
  // be noise; an instance run states the number and where to read the argument,
  // because a suppression nobody can see is the failure mode of the scope field
  // itself (bean `bjzs`).
  if (INSTANCE_RUN) {
    console.log(
      `  instance run: ${relative(repoRootFor(AUDITOR_ROOT), root) || "."} — ` +
        `${scopeSuppressed} \`repo\`-scoped criterion result(s) recorded n/a, each with its basis ` +
        `in the sidecar. ${KG_CRITERIA.filter((c) => c.scope === "repo").length} of ${KG_CRITERIA.length} ` +
        `criteria are \`repo\`-scoped; see \`scopeBasis\` in schemas/sdlc/kg-qa.ts.\n`,
    );
  }

  const bySeverity = new Map<KgSeverity, { subject: string; criterion: string; findings: number }[]>();
  for (const r of reports) {
    for (const [id, e] of Object.entries(r.criteria)) {
      if (e.result !== "fail" && e.result !== "unknown") continue;
      const sev = KG_CRITERIA_BY_ID[id]?.severity ?? "minor";
      const list = bySeverity.get(sev) ?? bySeverity.set(sev, []).get(sev)!;
      list.push({ subject: `${r.subject.kind}:${r.subject.id}`, criterion: id, findings: e.findings.length });
    }
  }
  for (const sev of (["critical", "major", "minor"] as KgSeverity[])) {
    const rows = bySeverity.get(sev) ?? [];
    if (!rows.length) continue;
    console.log(`${sev.toUpperCase()}  — ${rows.reduce((n, r) => n + r.findings, 0)} finding(s)`);
    for (const row of rows) console.log(`  · ${row.subject.padEnd(42)} ${row.criterion} (${row.findings})`);
    console.log("");
  }

  if (check && stale.length) {
    // Bean `oqe3`: a derived sidecar that differs from this run is not a
    // finding once its directory is stored — the record is rebuilt by
    // `qa:refresh` in CI, not committed. Said, so a stale working copy is
    // still SEEN, and gated only where the directory is not stored.
    console.log(
      `  ${derivedStored ? "advisory" : "✗"}: ${stale.length} derived sidecar(s) differ from this run's` +
        (derivedStored ? " (not gated: the kg-qa tree is stored on qa-reports; judge, never compare)" : ". Run `bun run cat kg:audit`:"),
    );
    for (const s of stale.slice(0, derivedStored ? 5 : stale.length)) console.log(`    · ${s}`);
    if (derivedStored && stale.length > 5) console.log(`    …and ${stale.length - 5} more`);
  }
  if (check && staleAttestations.length) {
    console.error(`${staleAttestations.length} attestation file(s) are not what this run would write. Run \`bun run cat kg:audit\` and commit:`);
    for (const s of staleAttestations) console.error(`  · ${s}`);
  }

  const worst = reports.map(worstSeverity).filter(Boolean) as KgSeverity[];
  const top = worst.sort((a, b) => rank[b] - rank[a])[0];
  console.log(top ? `Worst severity: ${top}` : "Clean.");
}

if (check) {
  const gate: KgSeverity[] = strict ? ["critical", "major"] : ["critical"];
  // ── JUDGE MODE (bean `oqe3`): compute, judge, write nothing.
  //
  // The graded findings are every failing or unknown criterion at the gate's
  // severity — what `tripped` below used to ask of `worstSeverity`, per entry
  // rather than per report so a NEW finding in a subject that already had an
  // old one is still new. Against `--against <ref>` only new ones fail; with
  // no readable baseline every one fails, as before. "Stale" no longer fails a
  // derived sidecar in a stored tree (there is nothing committed to be stale
  // against once 5hox lands); what still fails is what is COMMITTED — an
  // attestation file this run would rewrite, and an attestation no report
  // covers — and, where the tree is not stored, a stale or orphaned sidecar.
  const graded = (r: KgQaReport): unknown[] => gradedKgFindings(r, gate);
  const derivedFailing = derivedStored ? 0 : stale.length + orphans.length;
  const committed = staleAttestations.length + attOrphans.length;
  // `--json` owns stdout: the report array is parsed whole by its callers
  // (the needs-chain and Tool-subject tests), so the judge's lines go to
  // stderr there. The verdict and the exit are the same either way.
  if (asJson) console.log = console.error;
  const verdict = judgeSidecarTree({
    gate: JUDGE_GATE,
    fresh: reports.map((r) => ({ path: logicalSidecar(sidecarPath(r)), findings: graded(r) })),
    findingsOf: (text) => {
      try {
        const prior = JSON.parse(text) as KgQaReport;
        return prior?.$schema === KG_QA_SCHEMA && prior.criteria ? graded(prior) : undefined;
      } catch {
        return undefined;
      }
    },
    mode: "absolute",
    against,
    label: (p) => relative(root, p),
    extraFailing: {
      count: committed + derivedFailing,
      detail:
        `${committed} committed attestation file(s) out of date or orphaned` +
        (derivedFailing ? `, ${derivedFailing} stale or orphaned sidecar(s) in an unstored tree` : ""),
    },
    ...(attUnknown.size > 0 ? { undetermined: `${attUnknown.size} subject(s) whose judgements could not be read — nothing was written for them` } : {}),
  });
  process.exit(verdict.exit);
}
// The history of the judge above, kept because each rule in it was paid for.
//
// Until bean `oqe3` the exit was `stale || tripped || orphans || attOrphans ||
// attUnknown`, with `tripped` = some report's `worstSeverity` at the gate.
// `stale` and sidecar orphans were about the COMMITTED derived tree; once that
// tree is stored on `qa-reports` and rebuilt from empty by `qa:refresh`, a
// stale or orphaned sidecar cannot reach the record, so in a stored tree both
// are advisory. Everything below still holds where the tree is not stored,
// and for the committed attestation store, which is why `attOrphans` gates.
//
  // ORPHANS FAIL, and they did not until the count reached zero.
  //
  // The sweep printed its findings to stderr and `orphans` appeared nowhere in
  // this expression, so `kg:audit:check` reported twelve and exited 0 — a
  // report nobody fails on, which is `xom7`: from inside a checkout that looks
  // exactly like a clean run. CI ran this command and was green over all of
  // them.
  //
  // Gating earlier would have been gating a backlog, which is how a check gets
  // switched off within a week. The repository's own precedent is the ruff
  // comment in `code-quality-gates.yml`: **a check is an error only once its
  // count is zero.** The twelve were cleared in the commit that added this
  // line — four whose subject had moved, eight written before
  // `isPartOfASkill` existed — so it starts at zero and any new one is a
  // regression rather than debt.
  //
  // Three further points, from a second session that reached this same change
  // independently and whose merge is where these were folded in:
  //
  //   · WHY the severity gate could not already see them: orphans are computed
  //     outside `reports`, so `worstSeverity` has nothing to rank. They are not
  //     findings ABOUT a subject — a stale sidecar is a verdict that has not
  //     caught up, an orphaned one a verdict about something this run did not
  //     judge — which is why they sit beside `stale` rather than inside the
  //     severity ladder.
  //   · ALL THREE orphan groups count, the UNREADABLE one included. `AGENTS.md`
  //     on this repository's own sweeps: could-not-determine "is never rendered
  //     as clean" and it "outranks a finding" — a sweep blind on one check has
  //     not cleared the others. Excluding the unresolvable case would put the
  //     third state back on the pass side.
  //   · Only `--check` gates. Bare `kg:audit` is the WRITER and still exits 0,
  //     or regenerating after a rename would fail the very command you run to
  //     fix it.
// A subject whose judgements could not be moved (ruling 2) was NOT written —
// the writer says so with its exit code too, or a script running it would
// read a refusal as a clean save.
process.exit(attUnknown.size > 0 ? 4 : 0);
