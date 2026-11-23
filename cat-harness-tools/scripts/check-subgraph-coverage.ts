/**
 * Every declared subgraph should be REACHABLE — by a reader and by an agent:
 * it needs a visualiser and a documentation entry, and is reported if it has
 * no skill and no tools.
 *
 * An AXIS, not a gate: it reports, ranks, and exits 0 on findings.
 *
 * Coverage is READ FROM THE DECLARATION (`coverage` on the directory entry),
 * never inferred by scanning for a page that mentions the path. An absent
 * declaration is itself the finding:
 *
 * - declared-and-missing target → MAJOR (a claimed renderer is not there);
 * - undeclared → MINOR (nobody has said yet);
 * - unreadable declaration → `undetermined`, never a clean run.
 *
 * Bootstrap is exempt from the VISUALISER criterion, by layer; instead it is
 * asked whether its graph artefact (JSON/JSON-LD) is produced.
 *
 * @covers cat-harness
 */
import { HARNESS_ROOT } from "./lib/roots.ts";
import { existsSync } from "node:fs";
import { overlayPath } from "./lib/layer-output.ts";
import { join, relative, resolve, sep } from "node:path";

import { orderedDependencies } from "../schemas/kg/harness-config.js";
import { docsPages, documentingPages } from "./docs-declarations.js";
import { governingSkills, skillGovernance } from "./skill-governance.js";
import { processIndex, resolveProcess, type ProcessIndex } from "./governing-process.js";

import {
  instanceDirectories,
  AGENT_INSTRUCTIONS_ROLE,
  assetRolePurpose,
  INSTANCE_README_ROLE,
  layerRootsIn,
  isExemptFrom,
  readDeclaration,
  siteDirFor,
  checkoutRootFor,
  repoRootFor,
  instanceRootFor,
  directoryOwesSerialisations,
  owesVisualiser,
  resolveCoveragePath,
  type CatHarnessDeclaration,
  visualisationsOf,
  visualisationResolves,
} from "../schemas/kg/cat-harness.js";
import { withViewers } from "./viewer-declarations.js";
import { gitCorpus } from "../schemas/sdlc/git-corpus.js";

/** The three obligations, in the order the owner named them. */
export const CRITERIA = ["visualiser", "docs", "skill", "serialisations"] as const;

/**
 * What each criterion is asking, in the words the finding prints.
 *
 * A LOOKUP rather than the ternary chain this replaced: that chain had one arm
 * per criterion and no else, so a fourth criterion silently printed the third
 * criterion's question. A map cannot do that — an entry is required by the
 * type, and `tsc` says so at the point a criterion is added.
 */
const ASKS: Record<Criterion, string> = {
  visualiser: "renders it",
  docs: "documents it",
  skill: "governs it",
  serialisations: "serves its json, jsonld and schema.json",
};
export type Criterion = (typeof CRITERIA)[number];

/**
 * Criteria asked ONLY of a directory that declares them.
 *
 * `CRITERIA` above are OBLIGATIONS: every declared directory owes a
 * visualiser, documentation, a governing skill and its serialisations, so
 * silence there is the finding. `coverage.process` is not an obligation —
 * most directories are not the subject of a BPMN process, and reporting the
 * twenty-odd that are not would be the wall this file's own header says
 * somebody switches off.
 *
 * So there is exactly one question to ask here, and it is the `unresolvable`
 * half: somebody DID say, and what they said names no diagram. That is never
 * a backlog item. It is also the half a reader cannot see from the generated
 * README alone — the page prints *could not determine*, which is honest and
 * easy to scroll past.
 *
 * Kept as its own list rather than folded into `CRITERIA` with a skip, so the
 * `ASKS` lookup and the "one missing criterion, one finding" test below both
 * keep meaning what they say.
 */
export const DECLARED_ONLY_CRITERIA = ["process"] as const;
export type DeclaredOnlyCriterion = (typeof DECLARED_ONLY_CRITERIA)[number];
export type AnyCriterion = Criterion | DeclaredOnlyCriterion;

export type Severity = "major" | "minor";

/**
 * WHY a criterion is unmet, and the two answers are not the same kind of thing.
 *
 * `undeclared` — nobody has said yet. A backlog item, and the reason this
 * whole check is advisory (`2krx`): 2 of 22 directories declare a renderer,
 * and a hard gate on day one is a wall somebody switches off.
 *
 * `unresolvable` — somebody DID say, and what they said points at nothing.
 * That is never a backlog item; it is a wrong declaration, and this file's own
 * exit comment already said so — *"a declared-but-missing target is already a
 * defect rather than a backlog item"* — while having no way to act on it,
 * because both kinds were `major` and `--strict` is all-or-nothing. So the
 * backlog held the broken pointers hostage, which is how two of them sat in a
 * green report: `skills` still named the `cat-harness/` path its id carried
 * before `iwtn` renamed it, and `swimlane-glossary` named `glossary/`. Bean
 * `bsay`.
 *
 * A FIELD rather than a test on `detail`, because a rule that reads prose is a
 * rule that breaks when the prose is improved — and this repository has paid
 * for measuring a thing by its wording before.
 */
export type Unmet = "undeclared" | "unresolvable";

export interface CoverageFinding {
  instance: string;
  directory: string;
  criterion: AnyCriterion;
  severity: Severity;
  unmet: Unmet;
  detail: string;
}

export interface InstanceCoverage {
  instance: string;
  verdict: "checked" | "undetermined";
  declared: number;
  findings: CoverageFinding[];
  /** The instance-level README finding, when there is one. */
  readme?: { severity: Severity; detail: string };
  /** The instance-level `agent-instructions` finding — the AGENT half of the same pair. */
  agentInstructions?: { severity: Severity; detail: string };
  /** The instance-level `docs/` finding — does it have documentation OF ITS OWN? */
  ownDocs?: { severity: Severity; detail: string };
  /** Waivers honoured, with the reason each one gave. */
  exempted: Array<{ directory: string; criterion: Criterion; reason: string }>;
  /** Directories no kind of which owes serialisations (state, code or pages): not a waiver, the kind's answer. */
  serialisationsNotOwed?: string[];
  /**
   * Directories that OWE serialisations and declare none, while no layer in the
   * checkout declares a producer of serialisations at all
   * ({@link serialisationsProducerDeclared}). Not a waiver and not "not owed":
   * the obligation stands, and it is listed here rather than as a finding
   * because there is nothing a directory could declare that would be true
   * (owner, card "collab gate" B, 2026-11-13). The day one layer declares a
   * producer, every directory here becomes a major finding again.
   */
  serialisationsAwaitingProducer?: string[];
  reason?: string;
}

/**
 * The layer exempt from `visualiser`, and the layer only.
 *
 * A NAME rather than a path, because the exemption is about what bootstrap IS
 * — the floor that owns no renderer — not about where it happens to sit. A
 * layer that relocated would keep its exemption; a different layer that
 * moved into `bootstrap/` would not inherit one.
 *
 * BOTH NAMES, and the old one is not dead weight. `bootstrap` was renamed to
 * `bootstrap` on main while this branch was open, and the rename would
 * have made this set match NOTHING — the owner's exemption silently stops
 * firing, bootstrap is asked for a visualiser it is exempt from, and the
 * only symptom is one extra minor finding among fifty. Keeping the old name
 * costs nothing and means a half-finished rename in either direction does not
 * quietly revoke a ruling. The test below pins the set against the layers
 * discovery actually finds, so a name that matches nothing is a failure rather
 * than a silence.
 */
export const VISUALISER_EXEMPT_INSTANCES = new Set(["bootstrap", "bootstrap"]);

/**
 * Does this entry's declared target actually resolve?
 *
 * **Against the REPOSITORY root and nothing else**, via
 * {@link resolveCoveragePath} — the owner's ruling of 2026-09-21 on bean
 * `yt7j`, and one call site rather than a `resolve()` per consumer.
 *
 * This tried the layer root first and fell back to the repository root,
 * accepting either. That reads as tolerance and is the opposite: a path
 * incorrect in its declared base passed anyway through the other, so this
 * check could not enforce the convention its own schema documents. Measured
 * before the fallback came out — of **45** coverage paths in this repository,
 * **45** resolve from the repository root, and the fallback was load-bearing
 * for none.
 */
function targetExists(repoRoot: string, target: string): boolean {
  // A target may name a PATH or a node id (a skill or tool). Only a path can
  // be checked here; an id that names nothing is the knowledge-graph audit's
  // job, not this one — and reporting an id as "missing" because it is not a
  // file would be the axis lying about what it looked at.
  if (!target.includes("/") && !target.includes(".")) return true;
  // Over the layer overlay: a page a mounted layer builds at publish is at its
  // output root, not beside the pinned mount (bean `cat-tools-sm8r`).
  return existsSync(overlayPath(resolveCoveragePath(repoRoot, target)));
}

/**
 * Does this layer have a STARTING README of its own?
 *
 * The owner, 2026-09-20: *"each harness kind needs readme, it is added as a
 * reference to repo's root readme.md to explain what is in it"*. Bean `ie9l`.
 *
 * ## Why "of its own" is the whole criterion
 *
 * `check-declared-assets` already verifies that a declared asset RESOLVES, and
 * it reports zero findings here — because `cat-harness` declares
 * `src: "README.md"` with `scope: "repository"`, which resolves to the
 * REPOSITORY ROOT's README. The asset is fine. What is wrong is that one file
 * is doing two jobs: "what this repository is" and "what the cat-harness
 * instance is". A reader arriving at either question gets the other one's
 * answer mixed in.
 *
 * So this asks a question the resolve-check structurally cannot: does the
 * README live INSIDE the layer it describes? A repository-scoped README on
 * a non-root layer is a borrowed one, and that is the finding.
 *
 * MAJOR rather than minor, unlike the subgraph criteria: a layer with no
 * starting README is not a gap somebody has not filled in yet, it is a
 * layer a reader cannot enter. The subgraph criteria are minor because 2 of
 * 22 directories have a renderer and a wall of findings gets switched off;
 * there are four layers and three have a README, so this one can be sharp
 * from the start.
 */
export function readmeFinding(
  root: string,
  decl: { assets?: Array<{ role?: string; src: string; scope?: string }> } | undefined,
  isRepositoryRoot: boolean,
): { severity: Severity; detail: string } | undefined {
  return assetRoleFinding(root, decl, isRepositoryRoot, INSTANCE_README_ROLE);
}

/**
 * The same question, asked about the AGENT half of the pair.
 *
 * Added 2026-09-20 (issue #592) because the axis had only ever asked about the
 * README, and the number that argument rests on is the measurement: ten of
 * eleven layers declared `instance-readme` and **two** declared
 * `agent-instructions`. Nine layers were readable by a person and mute to
 * an agent, and nothing said so — not because the check disagreed, but because
 * it was never asked.
 *
 * Same severity as the README's, and for the owner's reason rather than by
 * symmetry: *"agents.md should give good coldstart instructions (dont
 * duplicatae readme.md) but augment"*. An augment that does not exist is not a
 * thinner answer to the reader's question; it is no answer to a different
 * question. See {@link ASSET_ROLES}, which is where each role says what
 * it is for, once.
 */
export function agentInstructionsFinding(
  root: string,
  decl: { assets?: Array<{ role?: string; src: string; scope?: string }> } | undefined,
  isRepositoryRoot: boolean,
): { severity: Severity; detail: string } | undefined {
  return assetRoleFinding(root, decl, isRepositoryRoot, AGENT_INSTRUCTIONS_ROLE);
}

/**
 * One implementation, asked once per role in {@link REQUIRED_ASSET_ROLES}.
 *
 * Written generically rather than copied because the three failure modes are
 * identical for both roles and the copy is where they drift: the `scope`
 * clause in particular is subtle enough that a second hand-written version
 * would plausibly omit it, and its absence reads as a clean layer.
 */
export function assetRoleFinding(
  root: string,
  decl: { assets?: Array<{ role?: string; src: string; scope?: string }> } | undefined,
  isRepositoryRoot: boolean,
  role: string,
): { severity: Severity; detail: string } | undefined {
  const purpose = assetRolePurpose(role) ?? role;
  const asset = (decl?.assets ?? []).find((a) => a.role === role);
  if (asset === undefined) {
    return {
      severity: "major",
      detail: `declares no \`${role}\` asset — nothing provides: ${purpose}`,
    };
  }
  // The repository root legitimately owns the repository's files; every other
  // layer reaching for a repository-scoped one is borrowing it.
  if (asset.scope === "repository" && !isRepositoryRoot) {
    return {
      severity: "major",
      detail:
        `declares its \`${role}\` \`scope: "repository"\`, so it resolves to the repository root's — ` +
        "one file doing two jobs, and a reader of either question gets the other's answer",
    };
  }
  if (!existsSync(resolve(root, asset.src))) {
    return { severity: "major", detail: `declares \`${role}\` \`${asset.src}\` and it is not there` };
  }
  return undefined;
}

/**
 * Does this layer have documentation OF ITS OWN, at `<instance>/docs/`?
 *
 * A DIRECTORY question, which is why it is not another `assetRoleFinding`:
 * README and `agent-instructions` are declared assets, and this is a tree.
 *
 * ## What it asks, and what it deliberately does not
 *
 * The owner, 2026-09-20, settling what a subject page under a handler means:
 *
 * (paraphrased) `<base>/cat-harness/docs/` is where all harness user
 * documentation is, so documentation at `<base>/cat-harness/docs/<instance>/`
 * is documentation ABOUT a content layer — how it is ingested and so on —
 * **not that layer's content**, whose source is `<instance>/docs` at the
 * repository root.
 *
 * Two different things, and an axis that conflated them would pass a
 * repository where half the documentation is missing. This asks only the
 * first: the layer's own source tree. A handler's rendering of a subject
 * is not the subject having documentation.
 *
 * ## Minor, and NOT in the `--strict` gate — on purpose
 *
 * Measured 2026-09-21 across the 12 layers discovery finds: **2 have a
 * `docs/`**. A check that fires on ten of twelve subjects on the day it lands
 * is one people learn to skim, and this repository's own rule is that a check
 * firing on every one of its subjects is a check that is wrong. It reports and
 * ranks; the count is meant to fall first. That is the staging `2krx` asked
 * for, for the same reason.
 *
 * @param root      the layer root
 * @param decl      its declaration, already parsed
 * @returns the finding, or `undefined` when it has `docs/` or is exempt
 */
export function ownDocsFinding(
  root: string,
  decl: Pick<CatHarnessDeclaration, "renderExemption"> | undefined,
): { severity: Severity; detail: string } | undefined {
  // An exemption is read from the DECLARATION, never from a name literal in
  // this file — the rule `isExemptFrom` exists for, and the one that stopped
  // bootstrap's visualiser exemption dying to a rename.
  if (decl !== undefined && isExemptFrom(decl, "own-docs")) return undefined;
  // `siteDirFor` rather than the string, and it is not merely to dodge the
  // literal: a layer's own documentation IS its site root. The first
  // draft hardcoded `"docs"` and two guards objected — `check:declared-paths`
  // ("a DIRECTORY the declaration already answers") and the site-root test,
  // which forbids the literal because getting that string wrong once
  // unignored 3,080 files. Both were right, and the resolver is the answer
  // to both rather than an exemption from either.
  //
  // It also supplies the third state for free: `siteDirFor` THROWS when it
  // cannot determine a site root, and "unreadable" is not "has no
  // documentation". A layer that will not resolve has not been shown to
  // lack docs; it has been shown to be undeterminable, which is a different
  // answer and belongs in `verdict`, not here.
  let siteDir: string;
  try {
    siteDir = siteDirFor(root);
  } catch {
    // NOT `undefined`. Returning nothing here would mean "has documentation",
    // and a layer whose site root cannot be resolved has not been shown to
    // have any — it has been shown to be undeterminable. The first draft
    // returned undefined and the tests caught it, which is the three-state
    // rule this file states elsewhere being broken in the act of citing it.
    return {
      severity: "minor",
      detail:
        "site root could not be determined, so whether it has `docs/` of its " +
        "own is UNKNOWN — not a finding that it lacks documentation",
    };
  }
  if (existsSync(resolve(root, siteDir))) return undefined;
  return {
    severity: "minor",
    detail:
      "has no `docs/` of its own — a reader entering this instance has its " +
      "README and nothing beneath it",
  };
}

/** The repository's tracked files, read once per repository. */
const trackedCache = new Map<string, string[]>();
function trackedFiles(repoRoot: string): string[] {
  let files = trackedCache.get(repoRoot);
  if (!files) {
    // `gitCorpus`, not a bare `git ls-files`: in a composed checkout every
    // layer is a REMOTE MOUNT, laid down from `index.lock.json` and ignored
    // by the index repository's git, so `ls-files` at the root lists none of
    // their files. `gitCorpus` counts a mount's files as it counted a
    // submodule's, and is tracked-plus-untracked exactly as before elsewhere.
    const listed = gitCorpus(repoRoot);
    files =
      listed !== undefined
        ? listed.map((f) => relative(repoRoot, f).split(sep).join("/"))
        : // Not a git checkout (a scratch repository in a test): the skills
          // and pages are whatever markdown and HTML sit on disk.
          [...new Bun.Glob("**/*.{md,html}").scanSync({ cwd: repoRoot })].filter((f) => !f.includes("node_modules/"));
    trackedCache.set(repoRoot, files);
  }
  return files;
}

/**
 * The `.bpmn` index, built at most once per repository per run.
 *
 * It reads every diagram in the repository, and `auditAll` calls
 * `auditInstance` once per layer — sixteen here — so building it inside
 * the audit would read the corpus sixteen times over. Cached on the repo root
 * for the same reason `trackedFiles` above is.
 */
const processIndexCache = new Map<string, ProcessIndex>();
function processes(repoRoot: string): ProcessIndex {
  let idx = processIndexCache.get(repoRoot);
  if (idx === undefined) {
    idx = processIndex(repoRoot);
    processIndexCache.set(repoRoot, idx);
  }
  return idx;
}

/** The roots a layer depends on; none when its graph cannot be resolved. */
function dependencyRoots(root: string): string[] {
  try {
    return orderedDependencies(root).map((d) => d.rootPath);
  } catch {
    return [];
  }
}

/**
 * Does ANY layer in this checkout declare what produces its serialisations
 * (`coverage.serialisations` on any of its directories, own or declared from
 * within)?
 *
 * While none does, a directory that owes serialisations has nothing true it
 * could declare: no generator writes `json`, `jsonld` and `schema.json` at a
 * directory's own URL, and naming one that writes something else
 * (`gen-subgraph-jsonld.ts` writes subgraph `index.jsonld` files) would be a
 * false claim. So each such directory is recorded as AWAITING a producer
 * rather than reported as a finding of its own, and adding a node-graph
 * directory no longer reads as a new failure to the PR gate (a layer adding
 * two `collab` entries, which were the only "new" lines). A declaration
 * that cannot be read counts as no producer, the answer that keeps the
 * obligation listed rather than silently satisfied.
 */
export function serialisationsProducerDeclared(repoRoot: string): boolean {
  for (const r of layerRootsIn(repoRoot)) {
    try {
      const decl = readDeclaration(r);
      if (!decl) continue;
      if (instanceDirectories(r, decl).some((d) => typeof d.coverage?.serialisations === "string")) return true;
    } catch {
      // Unreadable: reported by auditInstance as undetermined, not here.
    }
  }
  return false;
}

export function auditInstance(
  root: string,
  repoRoot: string = checkoutRootFor(root),
  opts: { serialisationsProducer?: boolean } = {},
): InstanceCoverage {
  const instance = root.split("/").pop() ?? root;
  let decl: CatHarnessDeclaration | undefined;
  try {
    decl = readDeclaration(root);
    // Own entries AND those declared from within (bean `cmsl`: `voices/` in
    // `skills/skills.json`) — reading only `decl.directories` stopped auditing
    // them the moment they moved; viewers RESOLVED from the pages (#1168 B7a-2b).
    if (decl) decl = { ...decl, directories: withViewers(instanceDirectories(root, decl), root, repoRoot) };
  } catch (e) {
    return {
      instance,
      verdict: "undetermined",
      declared: 0,
      findings: [],
      exempted: [],
      reason: `declaration unreadable: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (decl === undefined) {
    return {
      instance,
      verdict: "undetermined",
      declared: 0,
      findings: [],
      exempted: [],
      reason: "no declaration",
    };
  }

  const findings: CoverageFinding[] = [];
  const exempted: InstanceCoverage["exempted"] = [];
  const notOwed: string[] = [];
  const awaitingProducer: string[] = [];
  const producer = opts.serialisationsProducer ?? serialisationsProducerDeclared(repoRoot);
  const dirs = decl.directories ?? [];
  // Who governs what, read from the skills; and how far a kind claim reaches —
  // this layer, every layer it depends on, and the PLATFORM layer
  // this checker belongs to, whose skills govern every layer it serves.
  // Without the last, a layer declaring no dependencies (`agent-skills`)
  // was out of reach of the platform's own `library-ingestion`.
  const skills = skillGovernance(repoRoot, trackedFiles(repoRoot));
  const pages = docsPages(repoRoot, trackedFiles(repoRoot));
  const reach = [root, ...dependencyRoots(root), HARNESS_ROOT];

  for (const dir of dirs) {
    for (const criterion of CRITERIA) {
      if (criterion === "visualiser" && VISUALISER_EXEMPT_INSTANCES.has(instance)) continue;

      // SERIALISATIONS take no waiver, and `tsc` is what says so: dropping
      // the key from `exempt` in the schema turned this lookup into a type
      // error the moment the criterion was added, rather than into a silent
      // `undefined` that would have read as "not exempted" and worked by luck.
      //
      // The owner's ruling, 2026-09-20: *"harnesses cannot override there
      // being in the KG."* Rendering, documenting and governing are choices
      // about effort; addressability is the claim that the nodes are in the
      // graph at all.
      //
      // What is NOT owed is the kind's answer, not a waiver (owner, Q-SER-2
      // A, 2026-11-12): only a directory of a node-graph kind owes
      // serialisations, and it owes when ANY of its kinds does.
      if (criterion === "serialisations" && !directoryOwesSerialisations(dir.graphTypologies)) {
        notOwed.push(dir.id);
        continue;
      }
      const waiver = criterion === "serialisations" ? undefined : dir.coverage?.exempt?.[criterion];
      if (waiver !== undefined) {
        exempted.push({ directory: dir.id, criterion, reason: waiver });
        continue;
      }

      // The governing SKILL is read from the skills (#1168 B7b): the skill
      // declares the kinds or the directory it governs, and the directory
      // names none. Derived skills exist by construction, so there is no
      // "declared and does not resolve" case for this criterion.
      if (criterion === "skill") {
        if (governingSkills({ instance, id: dir.id, graphTypologies: dir.graphTypologies }, skills, repoRoot, reach).length > 0) continue;
      }
      // The DOCS page is read from the pages the same way (#1168 B7c): a page
      // says what it documents, and the directory names no page.
      if (criterion === "docs") {
        if (documentingPages({ instance, id: dir.id, graphTypologies: dir.graphTypologies }, pages, repoRoot, reach).length > 0) continue;
      }
      const declared = criterion === "skill" || criterion === "docs" ? undefined : dir.coverage?.[criterion];
      if (declared === undefined && criterion === "serialisations" && !producer) {
        awaitingProducer.push(dir.id);
        continue;
      }
      if (declared === undefined) {
        // An UNMET OBLIGATION outranks an unanswered question.
        //
        // The owner, 2026-09-20: a directory a layer declares or initiates
        // and then writes to — `beans/`, `todos/`, `fsh-guts/` — owes a
        // visualiser "as requiement of handler". So for those kinds a missing
        // one is not "nobody has said yet", it is a thing the declaring
        // layer promised and did not deliver.
        //
        // Ranked, not gated, and the axis stays advisory: 0 of 20 such
        // directories have one today, and a hard gate on day one is the wall
        // this file's own header says somebody switches off. What changes is
        // that the 20 stop being indistinguishable from the kinds that never
        // owed anything.
        // SERIALISATIONS are owed by every directory of a node-graph kind
        // (`owesSerialisations`; the rest were skipped above), and waivable by
        // none. `hfkl` is the reason it takes no waiver: bootstrap is excused a
        // VISUALISER precisely because its json/jsonld "is its existence", so
        // the thing it is excused into cannot itself be excusable. The
        // visualiser is the courtesy; the serialisation is the existence claim.
        const unmetObligation =
          criterion === "serialisations" ||
          (criterion === "visualiser" && dir.graphTypologies.some((g) => owesVisualiser(g)));
        findings.push({
          instance,
          directory: dir.id,
          criterion,
          severity: unmetObligation ? "major" : "minor",
          unmet: "undeclared",
          detail:
            criterion === "serialisations"
              ? `no serialisations declared — every directory of a node-graph kind owes json, jsonld and ` +
                `schema.json at its own URL, and this one is excused nothing`
              : unmetObligation
                ? `no visualiser declared, and ${dir.graphTypologies.filter((g) => owesVisualiser(g)).join(", ")} owes one — ` +
                  `an instance renders what it declares`
                : `no ${criterion} declared — nobody has said what ${ASKS[criterion]}`,
        });
        continue;
      }
      // A visualiser may now be SEVERAL — the owner's *"harness can declare >= 1
      // visualiztion"*. Each ref is checked on its own, so a directory whose
      // second visualisation is broken is reported for that one rather than
      // for the whole declaration: "one of your two viewers is missing" and
      // "your viewer is missing" are different repairs.
      // A visualisation built at publish (bean 0b8c) resolves by its writer:
      // its page is never committed, so the disk cannot be the answer.
      const exists = (r: string) => targetExists(repoRoot, r);
      const refs =
        criterion === "visualiser"
          ? visualisationsOf(dir.coverage, dir.id).map((v) => ({ ref: v.ref, ok: visualisationResolves(v, exists) }))
          : [{ ref: declared as string, ok: exists(declared as string) }];
      const broken = refs.filter((r) => !r.ok).map((r) => r.ref);
      if (broken.length > 0) {
        findings.push({
          instance,
          directory: dir.id,
          criterion,
          severity: "major",
          unmet: "unresolvable",
          detail:
            broken.length === refs.length
              ? `declares ${criterion} "${broken.join('", "')}" and it does not resolve`
              : `declares ${refs.length} ${criterion}s and ${broken.length} do not resolve: ` +
                `"${broken.join('", "')}"`,
        });
      }
    }
    // The DECLARED-ONLY criteria. A directory that declares no governing
    // process is asked nothing — see {@link DECLARED_ONLY_CRITERIA} — so
    // this loop starts from the declaration rather than from the criterion.
    for (const criterion of DECLARED_ONLY_CRITERIA) {
      const declared = dir.coverage?.[criterion];
      if (declared === undefined) continue;
      // Resolved by the SAME function the README generator uses, so the page
      // and this axis cannot disagree about whether the name points at a
      // diagram. A second resolution here would be a second answer.
      const resolved = resolveProcess(processes(repoRoot), declared);
      if (resolved.bpmn !== undefined) continue;
      findings.push({
        instance,
        directory: dir.id,
        criterion,
        severity: "major",
        unmet: "unresolvable",
        detail:
          `declares process \`${declared}\` and no instance in this repository declares ` +
          `\`${declared}.bpmn\` — \`${dir.path}\`'s README says "could not determine" where the diagram should be`,
      });
    }
  }

  // `resolve(root) === resolve(repoRootFor(root))` — a directory compared with
  // its own PARENT, which can only be equal at the filesystem root. So this was
  // false for every layer including the repository root itself, and the
  // guard below ("the repository root legitimately owns the repository's
  // files") could never fire for the one layer it exists for. Latent rather
  // than visible today: the root declaration's two assets carry no `scope`, so
  // nothing was being wrongly accused yet. Found while building
  // `resolveCoveragePath` (bean `yt7j`); the repository root is now passed in
  // rather than guessed at, which is the same fix in both places.
  const isRoot = resolve(root) === resolve(repoRoot);
  const readme = readmeFinding(root, decl, isRoot);
  const agentInstructions = agentInstructionsFinding(root, decl, isRoot);
  const ownDocs = ownDocsFinding(root, decl);
  return {
    instance,
    verdict: "checked",
    declared: dirs.length,
    findings,
    exempted,
    serialisationsNotOwed: notOwed,
    serialisationsAwaitingProducer: awaitingProducer,
    readme,
    agentInstructions,
    ownDocs,
  };
}

export function auditAll(repoRoot: string): InstanceCoverage[] {
  // Asked once for the checkout, not once per layer.
  const serialisationsProducer = serialisationsProducerDeclared(repoRoot);
  return layerRootsIn(repoRoot).map((r) => auditInstance(r, repoRoot, { serialisationsProducer }));
}

export function formatReport(rs: InstanceCoverage[]): string {
  const out: string[] = ["Subgraph coverage — visualiser, docs, governing skill, serialisations", ""];
  for (const r of rs) {
    if (r.verdict === "undetermined") {
      out.push(`  ? ${r.instance.padEnd(22)} undetermined — ${r.reason ?? "no reason given"}`);
      continue;
    }
    const major = r.findings.filter((f) => f.severity === "major").length;
    out.push(
      `  · ${r.instance.padEnd(22)} ${String(r.declared).padStart(3)} declared, ` +
        `${String(r.findings.length).padStart(3)} finding(s)` +
        (major ? `, ${major} MAJOR` : "") +
        (r.exempted.length ? `, ${r.exempted.length} exempt` : ""),
    );
    if (r.agentInstructions !== undefined) {
      out.push(`      ✗ ${r.instance} / agent-instructions: ${r.agentInstructions.detail}`);
    }
    if (r.readme !== undefined) {
      out.push(`      ✗ ${r.instance} / readme: ${r.readme.detail}`);
    }
    // A DIFFERENT glyph, because this one is advisory and the two above gate
    // under `--strict`. Printing them alike would invite a reader to treat a
    // backlog item and a defect as the same thing.
    if (r.ownDocs !== undefined) {
      out.push(`      · ${r.instance} / own-docs: ${r.ownDocs.detail}`);
    }
    for (const f of r.findings.filter((x) => x.severity === "major")) {
      out.push(`      ✗ ${f.directory} / ${f.criterion}: ${f.detail}`);
    }
    for (const e of r.exempted) {
      out.push(`      – ${e.directory} / ${e.criterion} exempt: ${e.reason}`);
    }
  }

  const noReadme = rs.filter((r) => r.readme !== undefined).length;
  const noAgents = rs.filter((r) => r.agentInstructions !== undefined).length;
  // Counted and reported as its OWN axis. It was argued for on the grounds
  // that the README and docs sets were disjoint; measured 2026-09-21 they are
  // not — every layer now declares a README, so docs is a strict subset.
  // The axes stay separate anyway, for the reason that survives the
  // measurement: they are different questions. "Can a reader enter this
  // instance" and "is there anything to read once inside" do not collapse into
  // one number just because one set happens to contain the other.
  const noOwnDocs = rs.filter((r) => r.ownDocs !== undefined).length;
  const notOwed = rs.reduce((n, r) => n + (r.serialisationsNotOwed?.length ?? 0), 0);
  const awaiting = rs.reduce((n, r) => n + (r.serialisationsAwaitingProducer?.length ?? 0), 0);
  const undet = rs.filter((r) => r.verdict === "undetermined").length;
  const all = rs.flatMap((r) => r.findings);
  const major = all.filter((f) => f.severity === "major").length;
  out.push("");
  out.push(
    `${all.length} finding(s) across ${rs.length - undet} instance(s) — ${major} major, ${all.length - major} minor.`,
  );
  if (notOwed) {
    out.push(`${notOwed} director(ies) not owed serialisations (state, code or pages): no kind of theirs is a node graph.`);
  }
  if (awaiting) {
    // One line, not one per directory, and no `✗`: the obligation is the
    // same unmet one for every directory until a producer exists, and a line
    // per directory made each new directory read as a new failure. `--json`
    // lists them by layer.
    out.push(
      `${awaiting} director(ies) owe serialisations and declare none, and no layer declares a producer yet — ` +
        "owed, not waived; each becomes a major finding once one does.",
    );
  }
  if (noReadme) {
    out.push(
      `${noReadme} instance(s) have no starting README OF THEIR OWN — an instance a reader cannot enter.`,
    );
  }
  if (noAgents) {
    out.push(
      `${noAgents} instance(s) have no \`AGENTS.md\` OF THEIR OWN — readable by a person, mute to an agent.`,
    );
  }
  if (noOwnDocs) {
    // ADVISORY, and it says so in the line itself rather than only in a
    // comment nobody reading the output will see. On the day this landed it
    // fired on 10 of 12, and a reader who does not know that is entitled to
    // read it as 10 defects.
    out.push(
      `${noOwnDocs} instance(s) have no \`docs/\` OF THEIR OWN — advisory, not gated: ` +
        "the count is meant to fall before this is held to.",
    );
  }
  if (undet) {
    out.push(
      `${undet} instance(s) UNDETERMINED — not a clean run. A sweep blind on one has not cleared the others.`,
    );
  }
  // The exemption is a second criterion rather than a hole, so say out loud
  // that it was applied — a waiver nobody sees is a silence list.
  out.push(
    `\`${[...VISUALISER_EXEMPT_INSTANCES].join(", ")}\` is exempt from \`visualiser\` by layer, ` +
      "and owes its own .json/.jsonld instead (owner, 2026-09-20).",
  );
  return out.join("\n");
}

if (import.meta.main) {
  const repoRoot = repoRootFor(instanceRootFor(import.meta.dir));
  const rs = auditAll(repoRoot);
  if (rs.length === 0) {
    console.error("No instance carries a declaration. That is not a clean run — nothing was checked.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(rs, null, 2) : formatReport(rs));
  // A DECLARATION THAT POINTS AT NOTHING IS FATAL, with no switch — and this
  // is not a tightening of the advisory, it is the half that was never
  // advisory in intent. The comment below has always said "a declared-but-
  // missing target is already a defect rather than a backlog item"; what it
  // lacked was a way to act on it, since `undeclared` and `unresolvable` were
  // both `major` and `--strict` fails on either. With the backlog at 20 of 22
  // that switch cannot be turned on, so the backlog held the broken pointers
  // hostage and two sat in a green report until bean `bsay`.
  //
  // FREE, and only now: both were repaired in the same change, so the count
  // is zero at the moment of promotion — this repository's rule for every
  // ratchet, and the only moment it costs nothing.
  //
  // It runs BEFORE the `undetermined` exit below on purpose. A layer whose
  // declaration will not parse is `2`, and a wrong ref inside one that parses
  // fine is a different repair; reporting the softer one first would hide it.
  const unresolvable = rs.flatMap((r) => r.findings.filter((f) => f.unmet === "unresolvable"));
  if (unresolvable.length > 0) {
    console.error(
      `\n✗ ${unresolvable.length} declaration(s) name a target that does not resolve.\n` +
        `  Not a backlog item: somebody DID declare it, and what they declared is wrong.\n` +
        `  Most often an id was renamed and the ref, which is keyed on the id, was not.\n`,
    );
    for (const f of unresolvable) {
      console.error(`  ${f.instance} / ${f.directory} / ${f.criterion}: ${f.detail}`);
    }
    process.exit(1);
  }

  // ADVISORY, by the rule at the top of this file. `--strict` is for the day
  // the minor count is low enough to hold, and for a caller who wants to pin
  // "no MAJOR findings" now — a declared-but-missing target is already a
  // defect rather than a backlog item.
  if (
    process.argv.includes("--strict") &&
    rs.some(
      (r) =>
        r.readme !== undefined ||
        r.agentInstructions !== undefined ||
        r.findings.some((f) => f.severity === "major"),
    )
  ) {
    process.exit(1);
  }
  if (rs.some((r) => r.verdict === "undetermined")) process.exit(2);
  process.exit(0);
}

export { join };
