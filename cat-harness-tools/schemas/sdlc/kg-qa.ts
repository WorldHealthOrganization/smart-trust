/**
 * Knowledge-graph QA sidecars — what is dangling in the process/role/skill graph.
 *
 * The third audit subject kind, after `<block>.qa.json` beside a content block
 * (`schemas/sdlc/block-qa.ts`) and `<script>.script-qa.json` beside a
 * computation (`schemas/sdlc/script-qa.ts`): the **knowledge graph itself** —
 * the BPMN processes, the DMN decisions, the roles that own their lanes and
 * the skills their activities name.
 *
 * The sidecar is committed, so the audit's previous answer is durable and a
 * diff shows exactly which findings a change introduced, telling a new defect
 * from inherited debt.
 *
 * ## Three states, and `unknown` is never rendered as a pass
 *
 * A criterion returns `pass`, `fail`, `n/a` (it does not apply to this
 * subject) or `unknown` (it could not be evaluated — the file would not parse,
 * a dependency was absent). `unknown` is not `pass` and not `fail`: a diagram
 * the loader choked on has not been audited. Same rule as
 * `check-ci-health.ts` and `pages-bootstrap.ts`.
 *
 * ## Severity decides the gate, not the finding count
 *
 * `critical` is a broken reference — something names a thing that does not
 * exist, and a consumer following it gets nothing. `major` is a missing join —
 * the graph is intact but a question cannot be answered, e.g. a lane bound to
 * no role, so "who performs this" has no answer. `minor` is coverage: a real
 * gap, but one with legitimate layers (a human signing something off is not
 * implemented by a markdown file), so failing on it would force a fake ref
 * onto a real step. `kg:audit --check` fails on `critical` only; `--strict`
 * adds `major`.
 *
 * @module schemas/kg-qa
 * @graphNode schema
 */

import { existsSync, readdirSync, readFileSync, type Dirent } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { z } from "zod";

import { KG_GRAPH_TYPOLOGY } from "../kg/cat-harness";
import { portableSegment } from "../kg/portable-path";
import { AdversarialReviewSchema, type AdversarialReview } from "./qa-review";
import { RunContextRefSchema, type RunContextRef } from "./run-context";

/** Marker value carried by every sidecar written by `scripts/kg-audit.ts`. */
export const KG_QA_SCHEMA = "kg-qa/v1";

/**
 * The auditor's identity, recorded ONCE for the whole corpus.
 *
 * It used to live in every sidecar. That was not 214 facts — `kg-audit.ts`
 * hashes itself once per run and threads the SAME value into every report, and
 * it has no subset mode, so the per-file copies could not differ from each
 * other in any run that has ever happened. What they could do is change
 * together: measured 2026-09-19, adding a single comment line to the auditor
 * rewrote **218 files**, none of whose verdicts had changed.
 *
 * That is what made two concurrent branches conflict by construction — both
 * regenerate the same 218 files, and git has no way to know the diff carries
 * no information. Recording the fact once costs one file per auditor change
 * and loses nothing, because there was never per-file precision to lose.
 *
 * Freshness is unaffected and still has two independent halves: this hash says
 * whether the AUDITOR is the one in the tree, and each sidecar's own
 * `source_hash` says whether its SUBJECT has moved since it was judged.
 */
export const KG_QA_MANIFEST_SCHEMA = "kg-qa-manifest/v1";

/**
 * Instance-relative location of that manifest, so every reader agrees on it.
 *
 * ## Why it moved out of `skills/` (2026-09-27)
 *
 * It was `skills/kg-qa.manifest.json`, which was harmless while ONE layer
 * was audited — cat-harness, which has a `skills/` directory. Auditing every
 * declared layer made it a defect: `kg-audit.ts` writes this file
 * unconditionally, so running the audit against a layer with no skills
 * CREATED a `skills/` directory holding nothing but this manifest. Measured on
 * the first full sweep: six layers (`smart-dak`, `smart-ig`, `smart-l1`,
 * `agent-skills` and two IG layers above this layer) gained one,
 * and the generated UML and navbar both moved to report a skills graph that
 * holds no skills.
 *
 * `test/results/` is where it belongs on its own terms, not merely where it is
 * harmless: this file describes the SIDECARS, and a fact about a set of
 * artefacts belongs with them. Its old home was an accident of the period when
 * the role graph and the skill packages shared one directory.
 *
 * It is the CONVENTION rather than a declaration read at run time, and that is
 * deliberate for one consumer's sake: `qa-witness.ts` reads it as
 * `join(repoRoot, KG_QA_MANIFEST_PATH)` and has no layer in hand. All 15
 * declared layers declare `qa` → `test/results/`, so the constant and every
 * declaration agree today; if one ever moves its `qa` directory, this is the
 * line that has to learn to ask.
 */
// declared-path-literal: the convention base case `qa-witness.ts` joins to a repository root it holds
// without a layer (above). The file is written by `kg:audit` into the `qa` working copy, which is
// not committed: it is published to the declared `storage` branch (bean `7mwa`, cat-harness#857).
export const KG_QA_MANIFEST_PATH = "test/results/kg-qa.manifest.json";

/**
 * The directory name sidecars used to sit in, beside their subject.
 *
 * Kept because the audit still has to SKIP such a directory when walking a
 * corpus that has not migrated, and because a folio consuming this platform
 * may still carry the old layout. Nothing in this repository writes one any
 * more — see {@link kgQaSidecarPath}.
 */
export const KG_QA_DIRNAME = "kg-qa";

/** Where KG verdicts live now, relative to the layer root. */
export const KG_QA_RESULTS_DIR = join("test", "results", "kg-qa");

/**
 * Where one subject's verdict lives — the ONE answer, for writer and reader.
 *
 * ## Why it is a function and not two path expressions
 *
 * It was two. `kg-audit.ts` composed the write path from the subject's own
 * directory and `pipeline/qa-witness.ts` composed the read path the
 * same way, independently — two spellings of one concept, which is the drift
 * this repository keeps paying for. They agreed only because neither had
 * changed. Moving the corpus is exactly the change that would have made them
 * disagree, and a reader that looks in the wrong place finds nothing and
 * reports a subject as unaudited, which is a false pass rather than an error.
 *
 * ## Why the tree MIRRORS the subject's path
 *
 * A flat directory keyed by stem collides, and not hypothetically: measured
 * 2026-09-19, four sidecar basenames already occur twice across packages —
 * `editor`, `getting-started`, `idle-backlog` and `l2-dak-authoring`. Flat,
 * four verdicts would silently overwrite four others. `kg-audit.ts` had
 * recorded the risk in a comment ("one shared directory would collide two
 * packages' skills of the same name") and kept the sidecars beside their
 * subjects because of it; mirroring keeps that guarantee while moving the
 * files, and keeps the package legible in the path.
 *
 * ## A subject OUTSIDE the layer has no sidecar here — its owner audits it
 *
 * **Refused, with {@link ForeignSubjectError}.** Until 2026-10-01 an outside
 * subject was re-rooted under `_external/` (bean `7u3g`, 2026-09-20), which
 * fixed a real defect — joining `..` CLIMBED OUT of `kg-qa/`, past the only
 * tree `sweepOrphans` walks — but kept the wrong premise: that a verdict about
 * another layer's subject belongs in THIS layer's tree at all.
 *
 * It does not. Measured 2026-10-01 (Q-A PR 4, epic `7x5n`): every one of the
 * eight `_external/` sidecars had a byte-for-byte counterpart under its owner's
 * own `test/results/kg-qa/`, written by that owner's `kg:audit:all` run. Two
 * copies of one verdict, about one subject, written by two runs — the second
 * free to disagree with the first, which is exactly what `resolvableSkills` in
 * `kg-audit.ts` records happening (`skill-ref-resolves` pass here, fail there,
 * for one diagram). The owner ruled the duplicates deleted (2026-10-01,
 * ~17:30: *"Delete them"*), and a writer that could still compose the path
 * would recreate them on the next run.
 *
 * So this function now answers "there is no such path" rather than inventing
 * one, and the CALLER decides: `kg-audit.ts` drops a subject an owning
 * layer in the checkout audits for itself, and refuses loudly on one no
 * layer owns; `qa-witness.ts` reads no sidecar for it. Use
 * {@link subjectEscapes} to ask first.
 *
 * A hosted layer (`bootstrap`) is unaffected: its subjects are INSIDE the
 * layer under audit (`--instance ./bootstrap`), and only the `tree` moves.
 *
 * ## The stem is a COMPOSED name, so it is encoded
 *
 * For a subject that carries no path the stem is its **id**, and an id never
 * had to be a legal filename. Requirement ids are `req:<slug>`, so this
 * function composed seven paths containing a colon — which NTFS reserves, so
 * `git clone` fetched every object and then refused to check out, aborting on
 * the first one. Measured 2026-09-21, from a user's terminal.
 *
 * {@link portableSegment} encodes it reversibly rather than substituting,
 * because substitution would collide — the one guarantee this whole tree
 * exists to provide. See `schemas/kg/portable-path.ts`.
 *
 * @param repoRoot   absolute layer root
 * @param subjectDir absolute directory the subject itself lives in
 * @param stem       the subject's filename without extension, or its id
 */
export function kgQaSidecarPath(
  repoRoot: string,
  subjectDir: string,
  stem: string,
  /** The `kg-qa/` tree to write under; the layer's own by default. See `kgQaHomeFor`. */
  tree: string = join(repoRoot, KG_QA_RESULTS_DIR),
): string {
  // `relative` rather than string surgery: a subject reached by a different
  // spelling of the same directory must land on the same results path, or the
  // writer and the reader disagree again by another route.
  if (subjectEscapes(repoRoot, subjectDir)) throw new ForeignSubjectError(repoRoot, subjectDir);
  const inside = relative(repoRoot, subjectDir).split(/[\\/]/).filter((seg) => seg !== "");
  // The STEM is encoded; the directory segments are not. They mirror a path
  // that is already on disk, so encoding them would make the mirror stop
  // matching the subject it mirrors — and a subject directory that is itself
  // unportable is a defect in that path, which `check:portable-paths` reports
  // at its source rather than papering over here.
  //
  // The stem has no such guarantee: it is a filename this function COMPOSES,
  // from an id that never had to be a legal filename. `req:agent-workflow` is
  // what made this repository unclonable on Windows — see `portable-path.ts`.
  return join(tree, ...inside, `${portableSegment(stem)}.kg-qa.json`);
}

/**
 * The subject directory a results file under `tree` mirrors: the inverse of
 * {@link kgQaSidecarPath}'s directory segments, for a file found by walking
 * the tree rather than composed from a subject (an orphan sweep). `undefined`
 * for a file outside `tree`.
 */
export function mirroredSubjectDir(file: string, tree: string, repoRoot: string): string | undefined {
  const rel = relative(resolve(tree), resolve(file, ".."));
  if (rel.startsWith("..") || isAbsolute(rel)) return undefined;
  return join(resolve(repoRoot), rel);
}

/**
 * Does `subjectDir` lie outside the layer at `repoRoot`?
 *
 * `relative` rather than a string prefix: `/repo/cat-harness-x` starts with
 * `/repo/cat-harness` and is not inside it. An absolute answer from `relative`
 * (a different drive on Windows) is outside too.
 */
export function subjectEscapes(repoRoot: string, subjectDir: string): boolean {
  const rel = relative(repoRoot, subjectDir);
  return rel === ".." || rel.startsWith(`..${sep}`) || rel.startsWith("../") || isAbsolute(rel);
}

/**
 * Raised by {@link kgQaSidecarPath} for a subject outside the layer: the
 * owner audits it and holds the one verdict. See that function's docblock.
 */
export class ForeignSubjectError extends Error {
  constructor(
    readonly instanceRoot: string,
    readonly subjectDir: string,
  ) {
    super(
      `${subjectDir} is outside ${instanceRoot}: a kg-qa sidecar is written only by the instance that ` +
        `owns its subject (Q-A PR 4, 2026-10-01). Audit it with \`kg-audit --instance <owner>\`.`,
    );
    this.name = "ForeignSubjectError";
  }
}

/**
 * The layer in `instanceRoots` that owns `absPath`: the DEEPEST root
 * containing it, because the repository root is itself a layer
 * (`folio-assistant`) and contains every other one. `undefined` when none does.
 */
export function owningInstanceOf(absPath: string, instanceRoots: readonly string[]): string | undefined {
  let best: string | undefined;
  for (const r of instanceRoots) {
    const root = resolve(r);
    if (subjectEscapes(root, absPath)) continue;
    if (best === undefined || root.length > best.length) best = root;
  }
  return best;
}

/**
 * Split an audit's reports by who owns their subject — the narrowing that
 * stops the auditor writing a second copy of another layer's verdict.
 *
 * - `kept` — no recorded path (role, requirement, graph, tool: callers narrow
 *   tools by declaring layer themselves), or a path inside `auditedRoot`.
 * - `skipped` — a path outside `auditedRoot` that another layer in
 *   `instanceRoots` owns. That owner's own run writes the verdict.
 * - `unowned` — a path outside `auditedRoot` that NO layer owns. Not
 *   dropped quietly: a subject nobody audits is the clean-run-over-nothing
 *   defect (`dh4f`), so the caller refuses.
 */
export function partitionBySubjectOwner<R extends { subject: { path?: string | null } }>(
  reports: readonly R[],
  auditedRoot: string,
  instanceRoots: readonly string[],
): { kept: R[]; skipped: { report: R; owner: string }[]; unowned: R[] } {
  const root = resolve(auditedRoot);
  const out = { kept: [] as R[], skipped: [] as { report: R; owner: string }[], unowned: [] as R[] };
  for (const r of reports) {
    const p = r.subject.path;
    if (!p) {
      out.kept.push(r);
      continue;
    }
    const abs = resolve(root, p);
    if (!subjectEscapes(root, abs)) {
      out.kept.push(r);
      continue;
    }
    const owner = owningInstanceOf(abs, instanceRoots);
    if (owner !== undefined && owner !== root) out.skipped.push({ report: r, owner });
    else out.unowned.push(r);
  }
  return out;
}

/** An orphan sidecar, and what its own `subject.path` says about why. */
export interface OrphanSidecar {
  /** Repo-relative path of the sidecar itself. */
  sidecar: string;
  /** `subject.path` as the sidecar records it, or `undefined` if it records none. */
  subject?: string;
  /**
   * `subject.kind` and `subject.id`, when the sidecar records them.
   *
   * The PATH is what changes when a subject moves; these two do not. Carried
   * so a relocation can be told from a deletion — see `relocateSidecars` in
   * `scripts/kg-audit.ts`. Optional for the same reason `subjectExists` is:
   * a sidecar that could not be read has no identity to offer, and guessing
   * one would move a verdict onto a subject it never audited.
   */
  kind?: string;
  id?: string;
  /**
   * Whether that subject is on disk. `undefined` means the sidecar could not
   * be read or names no path — a THIRD state, kept because "could not tell"
   * rendered as either answer is how the eight fragment sidecars below got
   * the wrong diagnosis in the first place.
   */
  subjectExists?: boolean;
}

/**
 * Sidecars under the results tree that this run did not write.
 *
 * ## Why it reads each sidecar rather than only its filename
 *
 * The first version asked one question — is this path in `written`? — and then
 * handed the reader a GUESS between two causes: *"Either the subject moved and
 * the sidecar should go, or it is no longer discovered from this root and the
 * DECLARATION is what is wrong."*
 *
 * Both branches were wrong for eight of the twelve it found, and the guess was
 * written into bean `3jj9` as a finding: *"their verdicts are real and the
 * cause is discovery, not staleness."* It is neither. Those eight declare
 * `part-of:` and are excluded by {@link isPartOfASkill}, deliberately and
 * correctly — a fragment measured against thresholds meant for a whole skill
 * produces findings about nothing, which is the defect that predicate was
 * added to remove. They are sidecars written BEFORE the exclusion existed.
 *
 * The sidecar already records `subject.path`. Reading it splits "the file is
 * gone" from "the file is there and was not audited" mechanically, which is
 * the difference between a dead verdict and a stale one — and the two want
 * opposite responses. One `existsSync` would have prevented the misdiagnosis.
 *
 * ## Still reports, still never deletes
 *
 * `deletion-requires-confirmation`: the agent reports what would go, with the
 * reason; a person decides. Splitting the report makes that decision possible
 * rather than making it automatic.
 */
export function sweepOrphans(
  root: string,
  written: ReadonlySet<string>,
  /** The `kg-qa/` tree to sweep; the layer's own by default. */
  tree: string = join(root, KG_QA_RESULTS_DIR),
): OrphanSidecar[] {
  const found: OrphanSidecar[] = [];
  const walk = (dir: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // No sidecar tree yet is not a finding.
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
        continue;
      }
      if (!e.name.endsWith(".kg-qa.json")) continue;
      if (written.has(resolve(full))) continue;
      const row: OrphanSidecar = { sidecar: relative(root, full) };
      try {
        const doc = JSON.parse(readFileSync(full, "utf-8")) as {
          subject?: { path?: unknown; kind?: unknown; id?: unknown };
        };
        const sp = doc.subject?.path;
        if (typeof sp === "string" && sp.length > 0) {
          row.subject = sp;
          row.subjectExists = existsSync(join(root, sp));
        }
        // Read whether or not a path was recorded: the identity is what a
        // relocation matches on, and it is independent of the path that moved.
        if (typeof doc.subject?.kind === "string") row.kind = doc.subject.kind;
        if (typeof doc.subject?.id === "string") row.id = doc.subject.id;
      } catch {
        // Leave `subjectExists` undefined: unreadable is its own answer.
      }
      found.push(row);
    }
  };
  // KG_QA_RESULTS_DIR, not KG_QA_DIRNAME. The first draft of this sweep used
  // the dirname ("kg-qa") and so walked `cat-harness/kg-qa`, which does not
  // exist — `readdirSync` threw, the catch returned, and the guard reported a
  // clean sweep over nothing on every run. It was caught only because the
  // orphan it was written for was put back and the guard stayed silent.
  // A guard that cannot fire is the defect it was written to prevent.
  walk(tree);
  return found;
}


/** What kind of node a sidecar audits. */
/**
 * The subject kinds this audit reports on.
 *
 * `tool` arrived last (issue #853, requirement 1) and is a different KIND of
 * member from the rest, which is worth saying because it changes what its
 * criteria are allowed to be. Every other kind's criteria DECIDE something
 * here. A Tool node's properties were already decided, by `check-tools.ts`,
 * `tools.test.ts` and `check-maintained-artefacts.ts` — measured 2026-09-22,
 * after a first attempt to add a `maintains` criterion turned out to be a
 * second answer to a question one of those already answers.
 *
 * So the `tool-*` criteria below PROJECT those verdicts rather than re-derive
 * them. What that buys is the thing a script cannot: a **committed sidecar per
 * Tool**, so "unbound since it was drawn" and "broken in the commit under
 * review" stop looking identical — the argument `AGENTS.md` makes for sidecars
 * over a printed verdict. It buys no new judgement, and a criterion here that
 * decided something `check-tools` does not would be the drift this note exists
 * to prevent.
 */
export const KG_SUBJECT_KINDS = ["process", "decision", "role", "requirement", "skill", "graph", "tool", "folio", "schema"] as const;
export type KgSubjectKind = (typeof KG_SUBJECT_KINDS)[number];

/**
 * Which declared GRAPH TYPOLOGY a subject of each kind lives in.
 *
 * Two vocabularies meet here and they are not the same axis. `KG_SUBJECT_KINDS`
 * above says what this audit judges — a process, a role, a skill. The graph-typology
 * registry (`BASE_GRAPH_TYPOLOGIES`) says what a layer DECLARES a directory of.
 * A `skill` subject inhabits a `skills` graph; a `tool` subject inhabits a
 * `tools` graph; nothing named `skill` or `tool` is a graph typology.
 *
 * ## Why this is declared and not derived
 *
 * `audit-coverage.ts` has to answer "how many criteria reach this KIND of
 * directory", and the only bridge between the two vocabularies was the
 * directory constants inside `kg-audit.ts` — resolved there, per subject, with
 * no exported statement of the correspondence. Reading it back out of those
 * constants means re-deriving a mapping from the shape of the code that uses
 * it, which is a guess dressed as a lookup: `DECISION_DIR` is
 * `join(WORKFLOW_DIR, "decisions")`, so a deriver sees a path and has to decide
 * whether that is its own kind. It is not — there is no `decisions` graph typology,
 * and a DMN file sits inside the `processes` graph.
 *
 * So the subject kind states which graph it inhabits, once, here. Every entry
 * must name a registered graph typology, and `kg-qa.test.ts` checks that against
 * the registry — a name that stops being a kind fails at the keyboard rather
 * than becoming a coverage row about a graph that does not exist.
 *
 * `Record<KgSubjectKind, string>` and not a partial map, so adding a subject
 * kind without saying where it lives does not compile. That is the
 * `GraphTypologyDef.holds` discipline: a required field makes "did not say"
 * impossible, where an optional one makes it indistinguishable from a default.
 */
export const KG_SUBJECT_GRAPH_TYPOLOGIES: Readonly<Record<KgSubjectKind, string>> = {
  // A `.bpmn` file in the `processes` graph.
  process: "processes",
  // A `.dmn` file in `processes/decisions/` — INSIDE the processes graph, and
  // not a kind of its own. See the note above.
  decision: "processes",
  // `scenarios/roles.json`. Roles moved out of the skills tree 2026-09-21.
  role: "scenarios",
  // `skills/requirements/` — a requirement is authored beside the skills that
  // satisfy it, and the skills tree is the `skills` graph.
  requirement: "skills",
  skill: "skills",
  // The knowledge graph AS A WHOLE — the `graph` subject's findings are about
  // the joins between nodes rather than about any one node, so its home is the
  // kg graph itself rather than the directory its sidecar happens to sit in.
  graph: KG_GRAPH_TYPOLOGY,
  tool: "tools",
  folio: "folio",
  schema: "schemas",
};

/** Outcome of one criterion. `unknown` is never a pass. */
export const KG_RESULTS = ["pass", "fail", "n/a", "unknown"] as const;
export type KgResult = (typeof KG_RESULTS)[number];

export const KG_SEVERITIES = ["critical", "major", "minor"] as const;

/**
 * The layer roots that can answer a criterion.
 *
 * `instance` — every declared layer can decide it about its own corpus.
 * `repo` — only the repository can; an instance run records `n/a` and says so.
 * `block` — evaluated at the content-block level within a folio graph.
 *
 * Two states rather than three: there is no "both", because a criterion that
 * the repository AND each layer can answer separately is `instance` and gets
 * asked once per layer, with the repository's own run being one of them.
 */
export const KG_CRITERION_SCOPES = ["instance", "repo", "block"] as const;
export type KgCriterionScope = (typeof KG_CRITERION_SCOPES)[number];

export type KgSeverity = (typeof KG_SEVERITIES)[number];

/** A criterion in the registry below. */
export interface KgCriterionDefinition {
  id: string;
  /** Subject kinds it applies to. Anything else records `n/a`. */
  applies: KgSubjectKind[];
  /**
   * WHICH LAYER ROOT can answer it — the second axis beside {@link applies}.
   *
   * `applies` asks *what kind of node is this about*; `scope` asks *whose
   * corpus can decide it*. They are independent, and the graph roll-up proves
   * it: `applies: ["graph"]` covers both `skill-in-role-or-process`, which every
   * layer can answer about its own graph, and `actor-roles-resolve`, which
   * only the repository can — because an actor is declared once for the whole
   * repository (`cat-harness/scenarios/actors/`) while a role is a swimlane inside
   * one layer's diagrams.
   *
   * **Required, deliberately.** A criterion that has not decided its scope does
   * not compile, for the same reason a graph typology must declare `renderable` and
   * `holds`: the default would be silent and wrong half the time.
   *
   * Added 2026-09-26 (bean `bjzs`) after `kg:audit --instance ./bootstrap`
   * reported **76 criticals of which 73 were false** — 36 repository-level
   * actors judged against bootstrap's 4 roles. The owner chose classifying every
   * criterion over declaring only the one measured to misfire.
   */
  scope: KgCriterionScope;
  /**
   * Why this criterion is `repo`-scoped. Required for `repo`, absent for
   * `instance`.
   *
   * The evidence, not the restatement — because a `repo` scope SUPPRESSES the
   * criterion in an instance run, and a suppression with no stated basis is
   * indistinguishable from a criterion somebody found inconvenient. Asserted by
   * `kg-qa.test.ts`, so the pair cannot drift apart.
   */
  scopeBasis?: string;
  severity: KgSeverity;
  /** One line, in the form of what a FAILURE means. */
  summary: string;
}

/**
 * The criteria, one per join in the actor→role→skill→task sentence.
 *
 * Ordered by where the join sits, not by severity: a reader walking a sidecar
 * should be walking the model.
 */
export const KG_CRITERIA: readonly KgCriterionDefinition[] = [
  {
    id: "tool-invoke-path-resolves",
    applies: ["tool"],
    scope: "instance",
    severity: "critical",
    summary:
      "A Tool names a command or module that does not exist, so it is unreachable through its own " +
      "declaration. Projects `unresolvedPaths()`; nine of forty-four checkable values were stale once.",
  },
  {
    id: "tool-satisfies-resolves",
    applies: ["tool"],
    scope: "instance",
    severity: "critical",
    summary:
      "A `satisfies` names a skill that does not exist — an edge to nothing, so the Tool claims to " +
      "implement something an agent cannot open. A skill declared by ANOTHER instance is neither " +
      "covered nor dangling, and is not a finding here.",
  },
  {
    id: "tool-satisfies-contract-met",
    applies: ["tool"],
    scope: "instance",
    severity: "major",
    summary:
      "A Tool claims to satisfy a skill whose input contract it has no port for, so it cannot actually " +
      "exercise the skill. A contract that is present but UNREADABLE records `unknown`, never a pass — " +
      "the rule `check-tools` already states as \"never counted as agreement\".",
  },
  {
    id: "tool-io-types-declared",
    applies: ["tool"],
    scope: "instance",
    severity: "major",
    summary: "An `io` port references a type the shared vocabulary does not declare.",
  },
  {
    id: "tool-args-shell-safe",
    applies: ["tool"],
    scope: "instance",
    severity: "critical",
    summary:
      "A command-line input has a type that can express a shell payload. `critical` because this is the " +
      "one projected criterion about what a Tool can be made to DO rather than whether it is wired up.",
  },
  {
    id: "tool-alternative-selectable",
    applies: ["tool"],
    scope: "instance",
    severity: "major",
    summary:
      "A Tool has a derived alternative (a shared skill and the same I/O signature, #1168 B9a) and no " +
      "`selection` — a choice the agent can see and cannot make. `n/a` for a Tool with no alternative, " +
      "which is most of them.",
  },
  {
    id: "tool-maintains-in-tree",
    applies: ["tool"],
    scope: "instance",
    // `minor`, and NOT because a rotted artefact is a small thing — it is a
    // 404 a reader follows. It is minor because from here this criterion can
    // only ever be `unknown`, and `unknown` counts toward `worstSeverity`.
    //
    // At `major` the seven Tools declaring `maintains` would put
    // `kg:audit:strict` permanently beyond reach, with no change to the
    // repository able to clear it. That is the failure mode this file already
    // names on `skill-in-role-or-process` — "a wall of false findings is how a
    // check gets switched off" — and `nested-instance-audited` is the exact
    // precedent: `minor` precisely BECAUSE the silence is correct and only its
    // invisibility was the defect.
    //
    // The real verdict is not softened by this. It is reached by
    // `check:maintained-artefacts` against the assembled tree, where a genuine
    // absence exits 1 and fails the docs-site workflow.
    severity: "minor",
    // THE THIRD STATE, and the reason this criterion is worth having at all.
    //
    // `maintains` asserts a Tool is authoritative for a PUBLISHED artefact, and
    // whether that artefact is in the tree is a question with no answer until
    // `_site/` is assembled. `check-maintained-artefacts.ts` asks it in the
    // `docs-site` workflow, after assembly, and exits 2 rather than 0 when
    // there is no tree.
    //
    // `kg:audit` runs on a checkout, where there is no tree. So this records
    // `unknown` with that reason — NOT `pass`. A sidecar claiming a green
    // `maintains` from a checkout would be green in exactly the place nobody
    // built the site, which is how the `docs-site` workflow failed 30 times
    // over two months without anybody noticing (`xom7`).
    //
    // It is not dropped instead, because "asked and unanswerable here" and
    // "never asked" are different facts and only the first tells a reader where
    // the answer lives.
    summary:
      "A Tool's `maintains` artefact is missing from the published tree. Answerable only against an " +
      // input-site: inert #c48dc5aa — prose naming the directory, in a message or a description
      "assembled `_site/`, so from a checkout this records `unknown` naming `check:maintained-artefacts` " +
      "as where the answer lives — never `pass`. `n/a` for a Tool that maintains nothing.",
  },
  {
    id: "tool-downstream-fresh",
    applies: ["tool"],
    scope: "instance",
    // `minor` for the same reason as `tool-maintains-in-tree`: a member judged
    // only in the published tree is ALWAYS `unknown` from a checkout, and
    // `unknown` counts toward `worstSeverity`, so anything higher would put
    // `kg:audit:strict` beyond the reach of any change to the repository.
    severity: "minor",
    // THE FAMILY, generalising `lsi-index-fresh` (bean `fq5u`, owner's design).
    // A Tool declaring `downstream` records each run's outcome and input
    // fingerprint (`folio-tool-run/v1`); this reads three states and only one
    // of them is a pass. No record, or a failed last run, is never green —
    // a file on disk is not evidence the run that keeps it current succeeded.
    summary:
      "A downstream Tool's output is not shown to be current: a target is STALE (a declared input changed since the " +
      "recorded run), NOT-RUN (no run record) or FAILED (the last run failed). Only a successful run over the current " +
      "input fingerprint passes. An output judged only in the assembled site records `unknown` naming its publish " +
      "verifier — never `pass`. `n/a` for a Tool that declares no downstream output, or none of whose targets is judged.",
  },
  {
    id: "skill-ref-resolves",
    applies: ["process"],
    scope: "instance",
    severity: "critical",
    summary:
      "An activity names a skill that does not exist, so an agent handed the step cannot open it. EXISTENCE ONLY: " +
      "whether this process may bind that skill (its instance reaching the skill's, through `needs`) is " +
      "`check:process-bindings`, and a pass here says nothing about direction (owner, 2026-10-04, bean mlux).",
  },
  {
    id: "decision-ref-resolves",
    applies: ["process"],
    scope: "instance",
    severity: "critical",
    summary: "A gateway names a DMN file or decision id that does not exist, so the branch cannot be computed.",
  },
  {
    id: "variable-performer-declared-alone",
    applies: ["process"],
    scope: "instance",
    severity: "major",
    summary:
      "A lane declares <bootstrap.processes:role variable=\"true\"/> AND a `ref`. It cannot be both: a lane that names " +
      "a role has not got a varying performer, and reading either one first would make the other silently " +
      "have no effect. `n/a` when no lane in the diagram declares a varying performer, which is also how a " +
      "reader tells a lane that binds no role BY DESIGN from one nobody got round to.",
  },
  {
    id: "role-ref-resolves",
    applies: ["process"],
    scope: "instance",
    severity: "critical",
    summary: "A lane's explicit <bootstrap.processes:role ref> names a role that is not declared.",
  },
  {
    id: "activity-in-lane",
    applies: ["process"],
    scope: "instance",
    severity: "major",
    summary: "An activity sits in no lane, so it has no role, so no actor can be said to perform it.",
  },
  {
    id: "lane-binds-role",
    applies: ["process"],
    scope: "instance",
    severity: "major",
    summary: "A lane matches no declared role, so 'which skills does this task's performer have' has no answer.",
  },
  {
    id: "role-carries-activity-skill",
    applies: ["process"],
    scope: "instance",
    severity: "major",
    summary:
      "An activity names a skill its lane's role does not carry — the task demands something the performer was never given.",
  },
  // ── The lane/role/skill report entries (owner, 2026-10-16) ─────
  //
  // Agreed with the owner in "BPMN lane, role and skill modelling": a lane
  // names a Role through BPMN `partitionElementRef`, and a mechanical role's
  // skills are its contract. The three entries below are REPORT entries, not
  // gates — hence `minor`, which `kg:audit` prints and neither `--check` nor
  // `--strict` fails on. The audit that computes them lives in the tools layer.
  {
    id: "lane-role-legacy-binding",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary:
      "A lane still binds its role with the deprecated `<bootstrap.processes:role ref>` instead of " +
      "`partitionElementRef` → a top-level `<bpmn:resource>` whose id is the role id. Read, with a warning, for one " +
      "release (`laneRoleRef` in `role-graph.ts`). `<bootstrap.processes:role variable=\"true\"/>` is a declaration, not legacy.",
  },
  {
    // The same join as `role-carries-activity-skill`, stated as the spec
    // states it so the report carries the agreed name: roles reached through
    // `inherits` count, and a `variable="true"` lane, which names no role, is
    // skipped rather than reported. The gating criterion above is unchanged.
    id: "task-skill-outside-lane-role",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary:
      "A task names a skill that is not among the skills of the Role its lane names, counting roles inherited " +
      "through `inherits`. Lanes declaring `variable=\"true\"` are skipped.",
  },
  {
    id: "skill-servable",
    applies: ["process"],
    scope: "instance",
    severity: "major",
    summary:
      "An activity names a skill that exists on disk but that `skill_fetch` cannot serve — its directory is " +
      "in no local package. `workflow_next` hands the agent a name, and fetching it returns \"package not found\".",
  },
  {
    id: "convention-ref-resolves",
    applies: ["process"],
    scope: "instance",
    // `critical`, and the severity is the whole point of this one.
    //
    // It is the DANGLING direction, not the absence direction. A diagram
    // naming a convention nobody wrote hands an agent a rule it cannot read —
    // the `blv9` shape, a link-shaped value that does not dereference.
    //
    // THERE IS DELIBERATELY NO CRITERION FOR ABSENCE. Bean `3190`: "absent
    // binding means no conventions, not all of them". Most steps legitimately
    // carry none, so a criterion that fired on an unbound activity would be
    // red across every diagram on the day it shipped and would train a reader
    // to ignore it — and worse, the only way to clear it would be to bind
    // conventions everywhere, which is the unconditional prose the bean
    // exists to replace. The check is that what IS bound resolves.
    severity: "critical",
    summary:
      "A `<cat-harness.processes:convention ref>` on a process, lane or activity names a convention that is not in " +
      "`cat-harness/skills/conventions/` (`conventionsDir`). The agent is told a rule applies and cannot read it.",
  },
  {
    id: "activity-names-skill",
    applies: ["process"],
    scope: "instance",
    // `major`, not `minor`, SINCE the exemptions became declarations.
    //
    // It was `minor` because it had legitimate layers it could not tell
    // from real gaps — a stakeholder's sign-off and an unwritten skill both
    // showed up as "names no skill", so gating would have forced a fake ref
    // onto a real step. That is no longer true: a `judgementOnly` lane and
    // `<cat-harness.processes:no-skill reason>` each SAY SO, and are recorded
    // `n/a`. (A third exemption, the `actedUpon` lane, was retired on
    // 2026-10-16: a mechanical role's tasks name its contract skills.) What remains is an activity whose performer is handed
    // nothing and which has not said why — a missing join, which is `major`.
    //
    // Not `critical`: nothing dangles. Every reference that exists resolves;
    // the defect is one that is absent, which is what the scale calls major.
    severity: "major",
    summary:
      "An activity names no skill and declares no reason for having none. Exempt: a call activity (implemented " +
      "by the process it calls), a lane whose role is `judgementOnly` (acts, but no procedure yields the answer), " +
      "and an activity carrying `<cat-harness.processes:no-skill reason=\"…\"/>`.",
  },
  {
    id: "activity-skill-has-tool",
    applies: ["process"],
    // A process is declared by the layer under audit, so `--instance` must
    // judge ITS diagrams and not the repository's. Same reasoning as every
    // other `process` criterion here.
    scope: "instance",
    // `minor`, and the grade is the argument. Every `critical` here is a
    // DANGLING REFERENCE and every `major` a gap between things that exist —
    // this is neither. The skill exists, the reference resolves, and the
    // absent thing is a MECHANISM nobody has promised: `check:tools` ruled in
    // its own docblock that a skill with no Tool is not an error, because
    // plenty of skills are pure judgement. Grading it `major` would gate
    // `kg:audit:strict` on 67 findings that are mostly correct.
    //
    // It needs no baseline for that reason: `kg:audit:check` gates `critical`
    // and `:strict` adds `major`, so a `minor` criterion reports without
    // gating and the backlog cannot redden a sibling's branch.
    //
    // NOT a second answer to `check:tools`, which counts the same relation
    // corpus-wide. That count cannot say WHICH activity hands a performer a
    // skill whose mechanism is still inlined in its prose, and the located
    // form is the whole reason this is a per-process sidecar. Measured
    // 2026-09-26 over `tools/discover.ts`: 99 distinct activity-named skills,
    // 32 with a Tool, 67 without.
    severity: "minor",
    summary:
      "An activity names a skill that exists and resolves, but no Tool declares `satisfies` for it — the " +
      "step's mechanism is still inlined in the skill's prose rather than being a thing an agent can " +
      "invoke. Not an error: many skills are pure judgement and name no mechanism on purpose " +
      "(`check:tools` carries that ruling and the corpus-wide count). Reported per activity because a " +
      "corpus total cannot locate the step.",
  },
  {
    id: "raci-role-resolves",
    applies: ["process"],
    scope: "instance",
    // `critical`, and the severity is argued rather than picked. Every
    // `critical` in this registry is a DANGLING REFERENCE and every `major`
    // is a gap between things that exist — and this is `role-ref-resolves`
    // on a different edge: a name in a RACI column that dereferences to no
    // declared role. Grading it lower would say the same defect matters less
    // depending on which attribute carries it.
    severity: "critical",
    summary:
      "A `<cat-harness.processes:raci ref>` names a role that is in no role registry, so 'who is accountable' " +
      "dereferences to nothing.",
  },
  {
    id: "raci-single-accountable",
    applies: ["process"],
    scope: "instance",
    // `major`: structural, not dangling. Every role named exists; what is
    // wrong is how many of them carry the decision.
    severity: "major",
    summary:
      "An activity declaring RACI does not have exactly one `accountable`. Zero is a breach too — a " +
      "half-annotated activity is worse than an unannotated one, because the chart looks complete.",
  },
  {
    id: "raci-accountable-not-consulted",
    applies: ["process"],
    scope: "instance",
    // `major` for the same reason, and not `minor`. `minor` here grades
    // INTENDED states (a stub, reference material nobody performs); this is a
    // modelling error that makes the chart read as complete while one of its
    // four letters is decorative.
    severity: "major",
    summary:
      "A role is both `accountable` and `consulted` on one activity — asking yourself is not " +
      "consultation, and it is how `consulted` quietly becomes a formality.",
  },
  {
    id: "raci-involvement-vocabulary",
    applies: ["process"],
    scope: "instance",
    // `major`, matching its two neighbours above, and the reasoning is the
    // same: every role named exists, so this is not a dangling reference. It
    // is a modelling error — a letter the process's chosen vocabulary does
    // not admit, which until 2026-09-23 was discarded during parsing with
    // nothing reporting it, so the chart read as complete while an
    // involvement somebody wrote had simply evaporated.
    severity: "major",
    summary:
      "A `<cat-harness.processes:raci involvement>` is not in the vocabulary its process declares — a typo, or " +
      "`supportive` where only RACI's four letters are in force. The value is neither coerced to a " +
      "neighbouring letter nor silently dropped; a process opts in to the fifth letter with " +
      "`<cat-harness.processes:involvement vocabulary=\"rasci\"/>`.",
  },
  {
    id: "activity-fulfilment-kind",
    applies: ["process"],
    scope: "instance",
    // `major`. Nothing dangles — both ends of this join resolve — so it is not
    // `critical`; and it is not coverage, so it is not `minor`. It is TWO
    // DECLARATIONS THAT CONTRADICT EACH OTHER: the diagram says this step runs
    // without a person, and the role graph says a person is who stands in that
    // lane. One of the two is wrong and the diagram cannot say which.
    severity: "major",
    summary:
      "An activity's lane is filled by an actor kind that cannot perform it. A `userTask` is performed by a " +
      "human (BPMN: \"by a human being with the assistance of a software application\"); a `serviceTask` runs " +
      "without one, so an agentic or mechanical actor performs it. `bpmn:Task` and a call activity assert " +
      "nothing and are `n/a`. Override the derived answer with `<cat-harness.processes:fulfilment kinds=\"…\" reason=\"…\"/>`; the reason is " +
      "required at load time, because widening `kinds` is the cheapest way to make this criterion pass.",
  },
  {
    id: "call-activity-resolves",
    applies: ["process"],
    scope: "instance",
    severity: "major",
    // `major`. A target resolvable from the repository parent root passes with
    // the hosting layer recorded in the evidence. A target resolving
    // nowhere is a `fail` (catching typos). `unknown` is kept only when the
    // diagram itself cannot be loaded.
    summary:
      "A call activity's `calledElement` names a process this instance or another instance in the repository can load. " +
      "It is the join that makes a call activity's skill exemption safe — without it, a typo in `calledElement` would " +
      "satisfy both criteria and implement the step with nothing at all. A target hosted by another instance passes " +
      "with that instance named; a target resolving nowhere fails.",
  },
  // ── Documentation completeness (bean `ooq3`, issue #1007) ─────────────
  //
  // The three criteria below ask whether a diagram can be READ, not whether it
  // runs. Every join above can pass over a process nobody can find: on
  // 2026-09-23 every one of 62 diagrams had a fresh SVG and `render:bpmn:check`
  // was green, while 45 of them were shown on no page. `adjudication.bpmn` was
  // one — drawn, rendered, merged, and reachable only by typing its URL.
  {
    id: "process-diagram-published",
    applies: ["process"],
    scope: "instance",
    // `major`: the diagram exists and is correct, so nothing dangles — what is
    // absent is the page a reader would meet it on, which the scale calls major.
    severity: "major",
    summary:
      "The rendered diagram is shown on no docs page. A fresh SVG proves `render:bpmn` ran, not that anybody can " +
      "reach the picture; the per-process pages `gen-processes-viz.ts` writes are what make this pass. `unknown` when " +
      "no docs layer is declared — an audit that could not look must not report a clean page.",
  },
  {
    id: "activity-documented",
    applies: ["process"],
    scope: "instance",
    // `minor`, and deliberately not gated. A step's NAME is often enough; the
    // measurement (95 of 456 undocumented) is the backlog, not a verdict that
    // each one is wrong.
    severity: "minor",
    summary:
      "An activity carries no `<bpmn:documentation>`, so its page can show a name and nothing about what the step " +
      "is for. The process-level documentation is not a substitute: it says why the diagram exists, not what one " +
      "step asks of its performer.",
  },
  {
    id: "activity-calls-skill-process",
    applies: ["process"],
    scope: "instance",
    // `minor` because the rule is a heuristic and says so. It fires only when
    // exactly ONE step in a diagram names a skill that owns a same-named
    // process: several steps naming one skill are using its know-how as steps
    // (five in `refresh-materialized` name `materialize-remote`), which a call
    // activity would get wrong. The raw match was 24; the rule leaves 9.
    severity: "minor",
    summary:
      "A single step names a skill that has its own process of the same name, but is a plain task rather than a " +
      "call activity — so the diagram re-describes the procedure instead of descending into it, and the called " +
      "process's page cannot say who calls it. Exempt: a step carrying `<cat-harness.processes:no-call reason=\"…\"/>`, which " +
      "records that it uses the skill for one slice rather than running its whole process.",
  },
  // ── Documentation completeness past activities (bean `6hq4`, issue #1044) ─
  //
  // Measured 2026-09-23 over all 62 diagrams: 123 gateways — 102 diverging
  // exclusive (DECISIONS), 9 converging exclusive, 6 parallel forks, 6 joins,
  // no inclusive (the model refuses them). 104 of 123 had no documentation, 83
  // of them decisions. Of 220 branches out of a decision, 0 were unnamed and 0
  // repeated a sibling's label; of 174 start/end events, 0 were unnamed — so
  // there is no event criterion, and lanes are `check:lane-documentation`'s.
  {
    id: "gateway-documented",
    applies: ["process"],
    scope: "instance",
    // `minor` and not gated, like `activity-documented`: 83 is a backlog, and
    // a well-named question with well-named branches often reads without
    // prose. Only DECISIONS are asked — a merge, fork or join decides nothing,
    // and its BPMN symbol already says everything true of it.
    severity: "minor",
    summary:
      "A decision (an exclusive gateway with more than one way out) carries no `<bpmn:documentation>`, so its page " +
      "shows the question and not what answers it: who decides, from what evidence, and what each branch commits " +
      "the process to. A DMN table or a `<cat-harness.processes:judgement reason>` is not a substitute — it says how the answer is " +
      "reached, not what is being asked.",
  },
  {
    id: "gateway-branches-named",
    applies: ["process"],
    scope: "instance",
    // `minor`, and it reads 0 on the day it was added: it holds a line the
    // corpus already meets rather than opening a backlog. Not `major`, because
    // an engine routes an unnamed branch correctly — what is lost is the
    // READER's ability to say which answer leads where.
    severity: "minor",
    summary:
      "A branch out of a decision has no name, or repeats a sibling's label, so a reader cannot tell which answer " +
      "takes it. Every branch of a decision needs a label distinct from the others on the same gateway.",
  },
  {
    id: "node-reachable",
    applies: ["process"],
    scope: "instance",
    // `major`: a node nothing can reach is not run, and a diagram is the
    // normative statement of what runs. Not `critical`, because the engine
    // does not fault on it — the step is simply never offered, which is the
    // quiet kind of wrong.
    severity: "major",
    summary:
      "A flow node no path from any start event reaches, and which reaches no start event either. A node that flows " +
      "INTO a start event is a PRE-START GATE and passes — `feature-staging`'s H_Confirm is one, and reporting it " +
      "would make a correct modelling decision a permanent finding.",
  },
  {
    id: "node-has-exit",
    applies: ["process"],
    scope: "instance",
    // `major` for the same reason, from the other end: control arrives and
    // the process neither continues nor ends.
    severity: "major",
    summary:
      "A node that is not an end event and has no outgoing flow, so control arrives and the process neither " +
      "continues nor terminates.",
  },
  // ── Readability (owner, 2026-10-31, thread "Improve BPMN quality checks
  // from research"). Evidence and what was left out: the module comment of
  // `src/workflow/diagram-quality.ts`. Counts are over the 76 processes of
  // cat-harness and cat-harness-tools on the day they were added. All but
  // two are `minor`: reported, never gated.
  {
    id: "activity-implicit-split",
    applies: ["process"],
    scope: "instance",
    // `major`: the semantics are ambiguous, not just the look — a reader
    // cannot tell a fork from a choice. 8 on the day it was added.
    severity: "major",
    summary:
      "A task has two or more outgoing sequence flows and no gateway, so a reader must guess whether the branches " +
      "run in parallel or one is chosen (Leopold, Mendling, Günther 2016). A loop-back INTO a task is not reported.",
  },
  {
    id: "gateway-mixed",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary: "One gateway both joins (2+ in) and splits (2+ out). Use a join gateway, then a split (7PMG G2, G4).",
  },
  {
    id: "process-size",
    applies: ["process"],
    scope: "instance",
    // `minor`: the 20 is house style (`bpmn-authoring`), stricter than any
    // threshold in the literature.
    severity: "minor",
    summary:
      "More than 20 flow nodes: split the process by phase into call activities (`bpmn-authoring`). House style, " +
      "stricter than the evidence, whose only number is 7PMG's 50 — see `process-decompose`.",
  },
  {
    id: "process-decompose",
    applies: ["process"],
    scope: "instance",
    // `major`: the one size threshold with evidence. 0 on the day it was added.
    severity: "major",
    summary:
      "More than 50 flow nodes. 7PMG G7: above 50 elements a model's error probability tends to exceed 50% " +
      "(Mendling, Reijers, van der Aalst 2010).",
  },
  {
    id: "process-single-start",
    applies: ["process"],
    scope: "instance",
    // Start events only. Several NAMED end events are this corpus's design —
    // the bean CLOSE call before each end — so G3's end half is not checked.
    severity: "minor",
    summary: "A process level has more than one start event (7PMG G3). One entry point per level, or a call activity per entry.",
  },
  {
    id: "decision-label-question",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary: "A named decision is not phrased as a question. A decision asks; its branch labels are the answers.",
  },
  {
    id: "activity-label-verb-first",
    applies: ["process"],
    scope: "instance",
    // `minor` and a heuristic: a noun or gerund ending on the first word. The
    // evidence (Mendling, Reijers, Recker 2010) is perceived ambiguity in one
    // questionnaire, not measured comprehension, so this never gates.
    severity: "minor",
    summary:
      "An activity label starts with a word that reads as a noun or gerund (`Signature verification`, `Reviewing`). " +
      "Use verb-object: an imperative verb, then its object (7PMG G6).",
  },
  {
    id: "edge-rectilinear",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary:
      "A sequence flow has a diagonal segment. Owner, 2026-09-23: keep edges rectilinear (`bpmn-processes`). " +
      "`n/a` for a diagram with no DI.",
  },
  {
    id: "edge-crossing",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary:
      "Two sequence flows cross. Same geometry as `archimate-crossings`. Owner, 2026-09-23: no overlapping. " +
      "`n/a` for a diagram with no DI.",
  },
  {
    id: "edge-through-node",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary:
      "A sequence flow runs over a flow node it does not connect. Route loop-backs in the channel below the lane " +
      "(`bpmn-processes`). `n/a` for a diagram with no DI.",
  },
  {
    id: "diagram-too-wide",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary:
      "The drawing is wider than 1400px, so at 100% it does not fit a screen and text shrinks when scaled. Split the process or tighten spacing (`bpmn:detangle --write`). " +
      "`n/a` for a diagram with no DI.",
  },
  {
    id: "diagram-too-tall",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary:
      "The drawing is taller than 900px, so at 100% it does not fit a screen. Split the process or tighten lanes. " +
      "`n/a` for a diagram with no DI.",
  },
  {
    id: "label-overlap",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary:
      "Two labels overlap, so neither can be read. Move one (`bpmn:detangle --write` places labels). " +
      "`n/a` for a diagram with no DI.",
  },
  {
    id: "label-on-edge",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary:
      "A label sits on a sequence flow, so the line runs through the text. Move the label off the line. " +
      "`n/a` for a diagram with no DI.",
  },
  {
    id: "label-on-shape",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary:
      "A label covers a shape or runs into its name. Move the label clear of the box. " +
      "`n/a` for a diagram with no DI.",
  },
  {
    id: "label-on-lane-line",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary:
      "A label crosses a lane or pool boundary, so it reads as if it belongs to two lanes. Keep it inside its lane. " +
      "`n/a` for a diagram with no DI.",
  },
  {
    id: "shape-overlap",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary:
      "Two flow nodes are drawn on top of each other. Move one. " +
      "`n/a` for a diagram with no DI.",
  },
  {
    id: "lane-order",
    applies: ["process"],
    scope: "instance",
    severity: "minor",
    summary:
      "Another lane order gives fewer lane jumps. Swap lanes (`bpmn:detangle --write` tries every order). " +
      "`n/a` for a diagram with no DI.",
  },
  {
    id: "prose-reviewed-since-code-changed",
    applies: ["process", "skill"],
    scope: "instance",
    // `minor` and not gated (R7, issue #1042): it asserts nothing about
    // whether the prose is TRUE, only that the code moved while the prose
    // describing it stood still. Gating waits for a clean run to show it does
    // not cry wolf — the lesson of bean `77ex`.
    severity: "minor",
    summary:
      "A declared prose ↔ code pair — a diagram and the workflow whose `# bpmn:` line names it, or a skill .md beside its same-stem .ts — " +
      "had its CODE change since the prose was last seen or attested, and the prose did not. Re-read it, then " +
      "`pairs:attest` with a reason. A prose edit never raises this; a missing side of a declared pair is `unknown`.",
  },
  {
    id: "skill-voice-review-current",
    applies: ["skill"],
    scope: "instance",
    // `minor` and not gated, by the owner's ruling on bean `rkqp`: an agentic
    // review of skills against the skill voices, with NO formal gate on rule
    // content. This asks only whether a current review exists; a rule the
    // reviewer judged `fail` is recorded in `voice_reviews`, never a finding.
    severity: "minor",
    summary:
      "An ACTIVE voice with rules scoped to skills (`appliesTo: [\"skill\"]`) has no review of this skill, or the " +
      "review predates a change to the skill or to the voice's skill rules. Review it rule by rule with each citation " +
      "open, then `bun run cat voice:review`. `n/a` when no such voice is active; `unknown` when the harness config is unreadable.",
  },
  {
    id: "prose-claims-resolve",
    applies: ["process", "skill"],
    scope: "instance",
    // `minor`, advisory (R7). Stage A of #1042: what the prose side of a
    // declared pair says about the code side, checked where it names a
    // resolvable thing. Measured before it shipped: 1 false, 23 holding and
    // 10 undetermined claims over 32 pairs — the undetermined are a folio's
    // files and scripts, which is why they are never counted as false.
    severity: "minor",
    summary:
      "The prose of a declared prose ↔ code pair names something that does not exist: a symbol not declared in the module " +
      "it cites, a module missing from a directory that exists here, a `bun run` file that is not there, or a " +
      "`# bpmn-node:` in the workflow naming an element the diagram does not have. `unknown` when every parsed claim pointed outside this repository.",
  },
  {
    id: "role-skills-resolve",
    applies: ["role"],
    scope: "instance",
    severity: "critical",
    summary: "A role carries a skill name that does not exist.",
  },
  {
    id: "role-inherits-resolves",
    applies: ["role"],
    scope: "instance",
    severity: "critical",
    summary: "A role inherits a role that is not declared.",
  },
  {
    id: "role-binds-a-lane",
    applies: ["role"],
    scope: "instance",
    severity: "minor",
    summary: "A declared role binds no lane in any diagram — a dangling role nothing can enter.",
  },
  {
    id: "role-has-actor",
    applies: ["role"],
    scope: "instance",
    severity: "minor",
    summary: "No declared actor is eligible for this role. Advisory: the actor registry is not a permission system.",
  },
  {
    // Unwritable until a role could admit a SET of kinds, because with one
    // kind per role every finding had two readings and the criterion could not
    // say which: is the role too narrow, or is the actor claiming a role it
    // cannot take on? `ce65` measured the mismatches and deliberately left
    // them rather than pick. Now that widening a role is sayable, a surviving
    // mismatch means the actor's `roles` list is wrong — one reading, so a
    // finding somebody can act on.
    //
    // `major`, not `critical`: nothing dangles. Both sides exist and are
    // readable; they contradict each other about what may fill a lane.
    id: "actor-kind-fits-role",
    applies: ["role"],
    // `instance`, though it consults the repository's actor set — and this is the
    // case that shows why scope follows the SUBJECT rather than the data read.
    // The subject is one layer's role, and the question is whether the actor
    // filling that lane is of a fitting kind, which that layer can act on.
    // MEASURED 2026-09-26: it produced NO findings in the `--instance ./bootstrap`
    // run, because it degrades to `n/a` when no actor declares the role — so it is
    // safe per layer rather than merely arguably so.
    scope: "instance",
    severity: "major",
    summary:
      "An actor declares this role, but its kind is not among the kinds the role admits — so either the " +
      "role is too narrow or the actor cannot take it on.",
  },
  {
    // A mechanical role is a real role whose skills are its contract (owner,
    // 2026-10-16); a contract nothing tests is a promise nobody checks. A
    // report entry, not a gate — see the note above `lane-role-legacy-binding`.
    id: "mechanical-role-untested",
    applies: ["role"],
    scope: "instance",
    severity: "minor",
    summary:
      "A role whose `actorKinds` are only `system` and/or `external` has no skill carrying a non-empty " +
      "`tested-by:` — its contract is stated and nothing holds it to it.",
  },
  {
    id: "requirement-statement-satisfied",
    applies: ["requirement"],
    scope: "instance",
    severity: "minor",
    summary:
      "A statement that no skill or capability claims — nothing declares `satisfies: req:<id>#<key>`, so " +
      "nothing is recorded as discharging it. Coverage: the satisfier names the statement (#1168), so an " +
      "unclaimed statement is visible only from here.",
  },
  {
    id: "requirement-actors-resolve",
    applies: ["requirement"],
    scope: "instance",
    severity: "critical",
    summary: "A requirement or statement binds an actor id the registry does not declare.",
  },
  {
    id: "requirement-derived-from-resolves",
    applies: ["requirement"],
    scope: "instance",
    severity: "critical",
    summary:
      "A requirement derives from a parent requirement that does not exist, so the conformance lattice has a " +
      "hole where a reader expects the broader obligation.",
  },
  {
    id: "requirement-statements-graded",
    applies: ["requirement"],
    scope: "instance",
    severity: "major",
    summary:
      "A statement carries no `conformance` grade. SHALL and SHOULD are the whole point of writing a " +
      "requirement rather than a note; an ungraded statement cannot be conformance-tested.",
  },
  // ── Is this role WRITABLE FOR? ────────────────────────────────
  //
  // A lane is the audience: a block sits in a lane, the lane names a role,
  // and the role is who the prose is for. That only works if the role says
  // enough to write for and to review against. `summary` says what the role
  // DOES, which is enough to draw a swimlane and not enough to author against.
  //
  // Both are `n/a` for a mechanical role (`isMechanicalRole` in
  // `role-graph.ts`) — asking who the corpus is or what it came to do is not a
  // question. Its skills are a contract, and `mechanical-role-untested` asks
  // the question that does apply. This was the `actedUpon` flag until
  // 2026-10-16.
  {
    id: "role-has-persona",
    applies: ["role"],
    scope: "instance",
    severity: "major",
    summary:
      "A role an author writes for carries no `persona` — nothing says what this reader already knows, " +
      "what they came to find out, or what would make the page useless to them.",
  },
  // No `role-declares-voice` (#1168, B2): a voice points at the role it
  // addresses, from a dependent layer this audit cannot see, so the
  // coverage is `check:voices`'s — reported from the side that can see both.
  {
    id: "role-has-story",
    applies: ["role"],
    scope: "instance",
    severity: "minor",
    summary:
      "No user story is told as this role — nothing says what this reader is trying to do. 'Is this well " +
      "written' is unanswerable; 'does this let them do the thing they came for' is not. Stories point at " +
      "their role from `scenarios/stories.json`; the role names none.",
  },
  {
    id: "decision-outcomes-used",
    applies: ["decision"],
    scope: "instance",
    severity: "major",
    summary: "A decision table is referenced by no gateway, or returns an outcome no branch is named for.",
  },
  // ── Is this skill short enough to be READ? ────────────────────
  //
  // A skill is read before acting, every time, by an agent with a finite
  // context. Length is a cost paid on every invocation, so it is a property of
  // the artefact and belongs in a sidecar — not an exhortation in the skill
  // files themselves, which is advice nothing measures and nothing enforces.
  //
  // Thresholds are MEASURED, not chosen. Across 123 skill files on
  // 2026-09-18 (`find skills -name "*.md" -not -path "*/kg-qa/*" -exec wc -l`):
  // 26,532 lines total, median 178, p75 279, p90 391, max 1280.
  //
  // `major` at 400 is roughly p90 — the tenth of files that are documents
  // rather than instructions. `minor` at 280 is roughly p75. Neither is a
  // style opinion; both say "this is longer than three quarters of its peers".
  {
    id: "nested-instance-audited",
    applies: ["graph"],
    scope: "repo",
    scopeBasis:
      "`unreadNestedInstances()` walks from `repoRootFor(root)` to find declarations, so it asks a " +
      "question ABOUT the repository's set of instances. MEASURED 2026-09-26: it fired 15 inside the " +
      "bootstrap run, reporting bootstrap's siblings as unread from inside bootstrap — which is the " +
      "root's question being asked in a place that cannot act on it.",
    // `minor`, because the SILENCE is correct and only its invisibility is the
    // defect. One layer's graph must not carry another's nodes — that is
    // `instance-graph-isolation.test.ts`, guarding a live 2026-09-19 leak of 88
    // references. So this audit rightly does not read a nested layer, and
    // rightly must not be made to.
    //
    // What was wrong is that nothing said so. On 2026-09-20 a session read
    // "named by no activity" as absolute, concluded the audit had a blind spot,
    // declared the nested directory at the root and re-introduced the leak the
    // test exists to prevent. Scoping the wording stopped that MISreading; this
    // criterion is the other half — it names the unread layer outright, so
    // the gap is a reported number rather than something to be deduced and
    // mis-deduced. Bean `sa8y`.
    severity: "minor",
    summary:
      "This tree holds a nested instance whose graph this audit does not read — correctly, but the unread corpus should be counted rather than silent.",
  },
  {
    id: "skill-is-a-stub",
    applies: ["skill"],
    scope: "instance",
    // `minor`, and the severity is the whole point. A stub is INTENDED
    // work-in-progress, not a defect: it exists so the graph traverses and
    // `skill_fetch` answers instead of failing mid-task. It must be VISIBLE —
    // otherwise stubbing a gap hides it, which is strictly worse than leaving the
    // gap open — and it must not gate, or the act of stubbing would turn CI red.
    //
    // `minor` gives exactly that: `kg:audit` prints it, `kg:audit:check` passes,
    // and `kg:audit:strict` does not promote it either. The owner's principle,
    // 2026-09-20: "stub things out knowing its not working. make sure QA checks
    // pickup so we can fix later. principle: KG is always a work in progress. QA
    // helps show where to work on it next, close gaps."
    severity: "minor",
    summary:
      "A skill is a declared stub: it exists so the graph traverses and skill_fetch answers, and its content is not here yet.",
  },
  {
    id: "skill-is-brief",
    applies: ["skill"],
    scope: "instance",
    severity: "minor",
    summary:
      "A skill is longer than 280 lines (p75 of the corpus) — an agent reads it before acting, " +
      "every time, and length is a cost paid on every invocation.",
  },
  {
    id: "skill-not-a-document",
    applies: ["skill"],
    scope: "instance",
    severity: "major",
    summary:
      "A skill is longer than 400 lines (p90) — at that length it is a document, and an agent that " +
      "skims it follows the part it happened to read.",
  },
  {
    id: "skill-no-repeated-heading",
    applies: ["skill"],
    scope: "instance",
    severity: "minor",
    summary:
      "A skill repeats a heading. The same section said twice is the redundancy that makes a long " +
      "skill long, and it leaves an agent no way to tell which copy governs.",
  },
  {
    id: "skill-has-entry-point",
    applies: ["graph"],
    scope: "instance",
    severity: "minor",
    // Renamed from `skill-reachable`, which was the honest check under a name
    // that promised more than it delivered. "Reachable" reads as "something in
    // the knowledge graph points at it"; what it means is "there is SOME way in
    // at all", and the servable clause alone covers nearly the whole corpus —
    // so it passes near-trivially and a reader took its green for an answer to
    // the graph question. Measured 2026-09-18: 143 known skills, this criterion
    // 0 findings, while 96 of those 143 are carried by no role and named by no
    // activity. Both numbers are true; only one was visible.
    //
    // `skill-in-role-or-process` below is the other question, asked separately
    // instead of folded in here, because the answers differ by two orders of
    // magnitude and one check cannot report both.
    summary:
      "A skill exists on disk but there is no way in at all — `skill_fetch` cannot serve it, no package " +
      "manifest lists it, no role carries it, no activity names it. The union is deliberate and the " +
      "SERVING registry is its load-bearing member: a skill nothing can fetch is unreachable however many " +
      "manifests name it. It does NOT mean the process model reaches the skill — that is " +
      "`skill-in-role-or-process`, which is a much larger number and not a defect list.",
  },
  {
    // Spec §7 of the lane / role / skill model, and the owner's rulings of
    // 2026-10-20 ("a1 b1 c1"): a step two or more processes reuse is a BPMN
    // global task in the layer's one shared `.bpmn` that holds no process,
    // called by bare id. A report entry, not a gate — see the note above
    // `lane-role-legacy-binding`. The audit that computes it lives with
    // the code that implements this layer's Tool definitions.
    id: "global-task-shared",
    applies: ["graph"],
    scope: "instance",
    severity: "minor",
    summary:
      "A global task is called by fewer than two of this instance's processes. A step only one process performs " +
      "is a plain task of that process, and one no process calls is dead (spec §7: global tasks only for steps " +
      "that 2 or more processes reuse).",
  },
  {
    id: "skill-in-role-or-process",
    applies: ["graph"],
    scope: "instance",
    severity: "minor",
    // NEVER gate on this, and it is `minor` so that it cannot.
    //
    // A skill invoked directly by name — `corpus-grep`, `diff`, `kg-export`,
    // `mcp-contract`, the watcher family — is doing its job without appearing
    // in any diagram, and `skill_fetch` by name is a first-class entry point.
    // Requiring a role or an activity would report ~two thirds of the corpus as
    // orphaned, and a wall of false findings is how a check gets switched off.
    //
    // It is reported rather than enforced because the question is real and was
    // unanswerable without re-deriving it by hand: "what does the actor → role
    // → task model actually reach?" The count moving is the signal, not its
    // absolute value.
    summary:
      "COVERAGE, not a defect: no role carries this skill and no activity names it, so nothing in the " +
      "actor/role/process model reaches it. Legitimate for a skill invoked directly by name, which most " +
      "are. Expect this to be large and to stay large; watch it move, do not drive it to zero. Skills " +
      "declaring `consulted: true` are EXCLUDED — reference material belongs in no lane by its nature, " +
      "so counting it measured this criterion rather than the corpus (bean `y1w9`).",
  },
  {
    id: "consulted-skill-not-performed",
    applies: ["graph"],
    scope: "instance",
    severity: "major",
    // The guard that makes `consulted: true` falsifiable, and the reason
    // the exemption above is safe to grant.
    //
    // A skill cannot be reference material AND a step somebody performs. If
    // a lane or a role claims one, either the annotation is wrong or the
    // binding is — and which it is takes a person, so this reports both
    // rather than choosing.
    //
    // `major` rather than `minor`, unlike the criterion it guards, because
    // the failure mode is different in kind. That one is coverage and
    // expected to be large; this is a CONTRADICTION between two
    // declarations, and there should never be any. Without it,
    // `consulted: true` would be an unfalsifiable opt-out — a worse field
    // than the one `qif9` removed, because that one at least did nothing.
    summary:
      "A skill declares `consulted: true` — reference material nobody performs — while a role carries it " +
      "or a BPMN activity names it. The two declarations contradict each other; a person decides which " +
      "is wrong. Guards the `consulted` exemption in `skill-in-role-or-process` from being an " +
      "unfalsifiable opt-out.",
  },
  {
    id: "downstream-tool-declared",
    applies: ["graph"],
    scope: "repo",
    scopeBasis:
      "Its three sources are repository-level, not per instance: the member readers are code in `scripts/downstream-runs.ts`, the publish " +
      "verifiers are `publish-verify`'s set, and run records live under the auditor's own `qa` directory. Asked per " +
      "instance it would judge the platform's members against an instance's Tools and report every one as undeclared.",
    // `major`: unlike a stale output, which is expected between runs, an
    // undeclared downstream tool is a DECLARATION gap that one edit clears.
    severity: "major",
    summary:
      "A downstream tool with no declaration (bean `fq5u`): a member reader, a `folio-tool-run/v1` record or a publish " +
      "verifier names a Tool that declares no matching `downstream` output. Its runs are then recorded and read by " +
      "nothing, or read and attributed to nothing — the invisible failure the family exists to end.",
  },
  {
    id: "manifest-skill-exists",
    applies: ["graph"],
    scope: "instance",
    severity: "critical",
    summary:
      "A `package-manifest.json` entry names a skill the instance cannot resolve anywhere. Checked against " +
      "the INSTANCE, never against the package's own directory listing: three manifests here are bundle " +
      "definitions whose bodies live elsewhere, and measuring them against their own folder reported 19 " +
      "false dangling entries (bean `nup0`).",
  },
  {
    id: "remote-skill-is-servable",
    applies: ["graph"],
    scope: "instance",
    // `major`, not `critical`: the reference is not broken, it points outside
    // this repository on purpose. What is missing is the JOIN — nothing fetches
    // the package, so a declared name has no body here. `critical` is reserved
    // for a reference that resolves nowhere at all.
    //
    // **It still gates**, via `scripts/tests/remote-skill-servable.test.ts`,
    // following the `activity-skill-coverage` precedent: switching CI to
    // `kg:audit:strict` would promote every `major` criterion at once, which is
    // a far larger commitment than the change that earned it.
    severity: "major",
    summary:
      "A file under `skills/remote-packages/` declares a skill this instance cannot serve. Both wrappers " +
      "carry `sync: { strategy: \"shallow-clone\", frequency: \"weekly\" }` and NOTHING performs it — " +
      "`skill_fetch` does not read the directory and the generated registry does not carry it — so five " +
      "names are published that a reader will try and cannot fetch (bean `wlqd`). The owner asked for this " +
      "to be a todo that FAILS rather than prose explaining itself, because the previous fix made the " +
      "documentation honest and left nothing that trips. Remedy: implement the sync (a platform capability " +
      "change, so a GitHub issue and the CRDM workflow first), or drop the declaration.",
  },
  {
    id: "actor-roles-resolve",
    applies: ["graph"],
    scope: "repo",
    scopeBasis:
      "An actor is declared ONCE for the whole repository (`cat-harness/scenarios/actors/`) while a role is a " +
      "swimlane inside one instance's diagrams, so this compares a repository-level set against an " +
      "instance-level one. MEASURED 2026-09-26: `--instance ./bootstrap` produced 73 findings, one for " +
      "almost every one of the 36 repository actors, because they name roles the bootstrap graph does " +
      "not declare. Every one was false.",
    severity: "critical",
    summary:
      "An actor lists a role that is not declared — the reverse of role-has-actor, and the direction " +
      "nothing checked: a typo in an actor's `roles[]` is silently ignored rather than reported.",
  },
  {
    id: "actor-capabilities-resolve",
    applies: ["graph"],
    scope: "repo",
    scopeBasis:
      "Both sides are repository-level — actors and capabilities (`cat-harness/scenarios/`) are resolved through " +
      "`repoRootFor`, so `--instance` does not move either. Re-asking per instance would re-derive the " +
      "root's own answer once per declaration and report the same findings N times.",
    severity: "critical",
    summary:
      "An actor claims an environment capability the registry does not declare. `critical` since 2026-09: " +
      "it was `major` only while `capabilities[]` was overloaded, carrying permissions and skills that no " +
      "vocabulary could ever resolve. Bean `ind9` split the field, so every remaining entry is a genuine " +
      "probe and a dangling one is a real broken reference.",
  },
  {
    id: "actor-permissions-resolve",
    applies: ["graph"],
    scope: "repo",
    scopeBasis:
      "Same shape as `actor-capabilities-resolve`: actors and `skills/permissions/permissions.json` are " +
      "both repository-level, so an instance run can only duplicate the root's verdict.",
    severity: "critical",
    summary:
      "An actor claims a permission `skills/permissions/permissions.json` does not declare. A permission " +
      "cross-cuts roles and travels with the participant, so it cannot be checked against the role graph.",
  },
  {
    id: "actor-is-not-a-role",
    applies: ["graph"],
    scope: "repo",
    scopeBasis:
      "The subject set is `ACTOR_DIR`, resolved through `repoRootFor`, so it is repository-level " +
      "and `--instance` does not move it. An instance run would re-derive the root's verdict over " +
      "the same actor files and report the same findings once per declaration.",
    severity: "minor",
    summary:
      "An entry in the actor registry carries `inherits` — it is modelling a role lattice, not an actor. Migration debt.",
  },
  {
    id: "actor-fact-has-consumer",
    applies: ["graph"],
    scope: "repo",
    scopeBasis:
      "Actor facts (capabilities and permissions) are declared on actors, which are repository-level " +
      "(`cat-harness/scenarios/actors/` resolved through `repoRootFor`), and evaluated against the repository's " +
      "processes, gateways, and rules. Evaluating per instance would report false findings for repository-wide " +
      "actors whose consumers live in sibling instances.",
    severity: "minor",
    summary:
      "A declared actor fact (capability or permission) has no consuming process, gateway, task, or rule in the KG.",
  },
  {
    id: "satisfies-resolves",
    applies: ["graph"],
    scope: "instance",
    severity: "critical",
    summary:
      "A skill's front matter or a capability names a requirement statement in `satisfies` that is not " +
      "declared, so the thing it claims to discharge cannot be opened.",
  },
  {
    id: "skill-graph-typologies-resolve",
    applies: ["graph"],
    scope: "instance",
    severity: "major",
    summary:
      "A skill's front matter names, under `graph-typologies:`, a graph typology the registry does not declare — it " +
      "claims to say how to read a kind of graph that does not exist.",
  },
  {
    id: "skill-contract-resolves",
    applies: ["graph"],
    scope: "instance",
    severity: "critical",
    summary:
      "A skill's front matter names an `input:` or `output:` contract that is malformed or not in the " +
      "instance, so what the skill is specified to take or produce cannot be opened.",
  },
  {
    id: "skill-contract-claimed",
    applies: ["graph"],
    scope: "instance",
    severity: "minor",
    summary:
      "A contract under `schemas/skills/` that no skill names as its `input:` or `output:` — specified " +
      "for nobody. The skill points at its contract, so this is visible only from the contract's side.",
  },
  {
    id: "test-run-skill-resolves",
    applies: ["graph"],
    scope: "instance",
    severity: "critical",
    summary:
      "A recorded test run does not parse, or names a skill that does not exist — a result attributed to " +
      "nothing. The run points at the skill it tests; the skill names no test.",
  },
  {
    id: "test-run-conforms",
    applies: ["graph"],
    scope: "instance",
    severity: "major",
    summary:
      "A recorded test run's cases violate the input or output contract of the skill it names, so it " +
      "measured something other than that skill as specified.",
  },
  {
    id: "test-run-checkable",
    applies: ["graph"],
    scope: "instance",
    severity: "minor",
    summary:
      "A recorded test run that cannot be checked against its skill's contract: the skill declares none, " +
      "the contract is external, or the run records only aggregates. Could-not-check, never a pass.",
  },
  // The test process (bean `3o5b`, proposal §3.2). Implemented once, in
  // `scripts/test-plan-audit.ts`, by following plan ← run ← report through the
  // schemas that already state each rule. `n/a` while no plan, plan-run or
  // report exists — never a pass over nothing.
  {
    id: "test-plan-resolves",
    applies: ["graph"],
    scope: "instance",
    severity: "critical",
    summary:
      "A test plan does not parse or names an exit-criteria DMN that does not resolve, or a plan-run or " +
      "test report names a plan, a plan version or a system under test that cannot be followed (an " +
      "undeclared actor, one with no system-under-test facet, or one of a different kind from the plan's scope).",
  },
  {
    id: "test-plan-exit-criteria-resolves",
    applies: ["graph"],
    scope: "instance",
    severity: "major",
    summary:
      "A test plan's exitCriteria names a decision table that does not resolve to an existing .dmn file " +
      "and decision (bean folio-assistant-4iey). Vacuity-guarded: unknown if 0 plans checked.",
  },
  {
    id: "test-case-executed-or-skipped",
    applies: ["graph"],
    scope: "instance",
    severity: "major",
    summary:
      "A terminal test report leaves a case of its plan with no verdict, or gives a verdict for a case the " +
      "plan does not contain. Every case is executed or explicitly skipped with a reason; a report whose plan " +
      "cannot be followed is `unknown`, never a pass.",
  },
  {
    id: "test-data-hash-present",
    applies: ["graph"],
    scope: "instance",
    severity: "major",
    summary:
      "A plan-run's data hash is `unknown`, or a test report's run carries no known data hash — what was " +
      "tested cannot be established, so the result cannot be certified (zz0a).",
  },
  {
    id: "test-sut-not-self-judged",
    applies: ["graph"],
    scope: "instance",
    severity: "critical",
    summary:
      "A verdict in a test report names the system under test as its reviewer — a system judging itself " +
      "(untainted-verification). The schema refuses it; this records it under its own name.",
  },
  // Owner, 2026-11-06: "A test should always have a Gherkin." Instance-scoped
  // rather than a per-block `depends_on: ["feature"]` criterion: tests are not
  // content blocks, and no built-in content adapter declares a `feature`
  // companion, so a block criterion would record `n/a` everywhere outside one
  // contributed adapter — coverage that is not there. `major`, so a layer
  // that has not backfilled records the gap without failing `--check`.
  // Implemented in `scripts/test-plan-audit.ts`; scanner `scripts/lib/test-gherkin.ts`.
  {
    id: "test-has-gherkin",
    applies: ["graph"],
    scope: "instance",
    severity: "major",
    summary:
      "An executable test that no Gherkin Scenario names with `@test:<file>::<scope>::<name>`, a `@test:` tag " +
      "that names no test, a test named by two Scenarios, a Scenario that names no test and is not `@manual`, or a " +
      "test-plan case whose `.feature` is missing or does not resolve (skill test-engineer, \"Every test has a Gherkin\").",
  },
  // The certification family (bean `zaui`, Done-when 2): until this, nothing
  // judged `<attestations>/certification/**`, so audit:coverage could count the
  // family only as typed. Implemented beside the four above, in
  // `scripts/test-plan-audit.ts`.
  {
    id: "certification-resolves",
    applies: ["graph"],
    scope: "instance",
    severity: "major",
    summary:
      "A filed certification does not parse as the `certification` family, records a decision other than " +
      "`certified` (a refusal filed as a certification is the false green the test process exists to " +
      "prevent), names a test plan no declared `test-plan` directory holds, or points at no evidence. " +
      "Evidence that is not in this checkout — a report kept on `qa-reports` — is `unknown`, never a pass; " +
      "no certification filed is `n/a`.",
  },
  {
    id: "arrow-direction",
    applies: ["graph"],
    scope: "instance",
    severity: "major",
    summary:
      "A general node names one of its dependents: a `@general` schema `@ref`s a declaration that is not " +
      "general, or a BPMN process points at something that implements or documents it. The dependent " +
      "should hold the pointer (data-modelling step 8).",
  },
  {
    id: "prose-names-resolve",
    applies: ["graph"],
    scope: "instance",
    // `minor` and advisory (bean `epbt`). Prose may name a dependent as
    // explanation — the arrow rule governs data — so this never says a name
    // should not be there, only that it no longer resolves.
    severity: "minor",
    summary:
      "A general node's prose — a BPMN process's documentation, or a `@general` declaration's doc comment — names " +
      "a file whose directory is in this checkout and which is not: renamed, moved, or never written. A bare name " +
      "nothing here carries is undetermined (a run's output, a folio's file, an example) and not reported.",
  },
  {
    id: "story-role-resolves",
    applies: ["graph"],
    scope: "instance",
    severity: "major",
    summary:
      "A user story in `scenarios/stories.json` is told as a role the role graph does not declare — a story " +
      "told as nobody, which no author can write for and no reviewer can check against.",
  },
  {
    id: "content-instance-holds-code",
    applies: ["graph"],
    scope: "instance",
    // `minor` — a QA WARNING, not a failure — by owner ruling, 2026-10-01:
    // "QA warning. not failure.. ok b/c small # tools" (bean `eayu`; separation
    // arc S0, #1770). It was `major` on the argument that FR-7 admits no
    // exception; the owner overruled that for the tolerated case: the five
    // IRIS-specific files STAY in the IRIS replica and no tools repository for it is
    // authorised. `minor` still records `fail` and still names every file, so
    // the detection is kept and the violation stays visible — it simply fails
    // neither `kg:audit --check` nor `--strict`. The ruling's warrant is that
    // the tolerated set is SMALL; revisit the severity if it grows.
    severity: "minor",
    summary:
      "An instance declared as a CONTENT repository (`separation: \"content\"`, or the content half a " +
      "declared tools instance `supports`) holds code. A content repository holds no code (kg-separation, " +
      "bootstrap FR-7); each file is named, and belongs in the platform or a `<name>-tools` repository.",
  },
  {
    id: "block-reference-resolves",
    applies: ["folio"],
    scope: "block",
    severity: "minor",
    summary:
      "A content block's relative links, computation.script path, or {{...}} macro templates do not resolve against " +
      "the instance's declared directories. Guarded by vacuity and undetermined states; report-only warning.",
  },
  {
    id: "orphan-subject-resolves",
    applies: ["graph"],
    scope: "repo",
    scopeBasis:
      "Artefacts across declared graph kinds (beans, qa-sidecars, attestations) are resolved at the " +
      "repository root via `repoRootFor(root)`. Re-asking per instance would judge repository-level " +
      "stores like `beans/` repeatedly or report false orphans against an instance-local subset.",
    // Non-blocking `minor` severity with vacuity guard (bean folio-assistant-9mmu).
    severity: "minor",
    summary:
      "An artefact across declared graph kinds references an orphan target or subject that does not exist in the " +
      "graph (e.g. beans referencing nonexistent parents, sidecars whose subject file is missing, etc.). " +
      "Vacuity-guarded: empty candidate set returns `unknown`, never a false pass.",
  },
  {
    id: "work-traceability-audit",
    applies: ["graph"],
    scope: "instance",
    severity: "minor",
    summary:
      "Audit work traceability between declared beans, content blocks, and Lean declarations. " +
      "Flags unassociated blocks, beans with no targets, and broken target references. Vacuity-guarded when no beans or blocks exist.",
  },
  {
    id: "lake-target-lean-resolution",
    applies: ["graph"],
    scope: "instance",
    // `minor` advisory QA warning (folio-assistant-tntp). Vacuity-guarded: if 0 blocks/refs checked -> unknown.
    severity: "minor",
    summary:
      "A block's lean.ref resolves to an uncompiled chapter-dir sibling (.lean) only or dangles without landing in a Lake target CI builds.",
  },
  {
    id: "redundant-rendered-content-audit",
    applies: ["graph"],
    scope: "repo",
    scopeBasis:
      "Rendered HTML output across the built site or documentation tree is evaluated at the repository level against committed repository-level knowledge graph nodes, so an instance run cannot evaluate whole-site bloat in isolation. MEASURED across assembled sites.",
    severity: "minor",
    summary:
      "Rendered HTML pages carry large redundant markup blocks repeated across pages or duplicated from committed KG JSON/JSON-LD files that could be dynamically loaded client-side.",
  },
] as const;

export const KG_CRITERIA_BY_ID: Readonly<Record<string, KgCriterionDefinition>> = Object.fromEntries(
  KG_CRITERIA.map((c) => [c.id, c]),
);

/** One thing wrong, named specifically enough to fix without re-running. */
export interface KgFinding {
  /** The node inside the subject — a BPMN element id, a lane name, a skill. */
  where: string;
  /** What is wrong, in one sentence, naming both ends of the broken join. */
  detail: string;
}

export interface KgCriterionEntry {
  result: KgResult;
  /** Empty on `pass`; on `unknown` it carries why it could not be evaluated. */
  findings: KgFinding[];
}

/** The audited node. */
export interface KgSubject {
  kind: KgSubjectKind;
  /** Stable id — the BPMN process id, the role id, `kg` for the roll-up. */
  id: string;
  /** Repo-relative path, or `null` for the roll-up, which has no one file. */
  path: string | null;
}

/** What produced the sidecar — the same provenance block the block sweep keeps. */
export interface KgAuditor {
  script: string;
  script_hash: string;
  engine_version: string;
}

/**
 * The corpus-wide auditor record. See {@link KG_QA_MANIFEST_SCHEMA} for why
 * this is one file rather than a block in each sidecar.
 */
export interface KgQaManifest {
  $schema: typeof KG_QA_MANIFEST_SCHEMA;
  auditor: KgAuditor;
  /**
   * Content-addressed reference to the `folio-run-context/v1` record of the
   * run that wrote this manifest (`docs/proposals/tool-releases-2026-10-07.md`,
   * owner C1 = a).
   */
  runContext?: RunContextRef;
}

export interface KgQaReport {
  $schema: typeof KG_QA_SCHEMA;
  subject: KgSubject;
  /** sha256 of the audited file, or `null` for the roll-up. */
  source_hash: string | null;
  /** Criterion id → entry. Criteria not applying to this kind are omitted. */
  criteria: Record<string, KgCriterionEntry>;
  totals: Record<KgResult, number>;
  // Optional adversarial reviews, compatible with kg-qa/v1 (folio-assistant-abmq)
  adversarial_reviews?: AdversarialReview[];
  /**
   * Content-addressed reference to the `folio-run-context/v1` record of the
   * run that wrote this report (`docs/proposals/tool-releases-2026-10-07.md`,
   * owner C1 = a).
   */
  runContext?: RunContextRef;
  // NO judgements here. `pair_attestations` and `voice_reviews` lived in this
  // report until bean `2gst` (2026-10-01): they are what an earlier run or a
  // reviewer recorded, so they cannot be regenerated, and owner ruling D2 (a)
  // keeps them on main while this derived report moves to the `qa-reports`
  // branch. They are in the attestation store now —
  // `schemas/sdlc/qa-attestations.ts`, `test/attestations/kg-qa/`.
}

export const KgFindingSchema = z.object({
  where: z.string(),
  detail: z.string(),
});

export const KgCriterionEntrySchema = z.object({
  result: z.enum(KG_RESULTS),
  findings: z.array(KgFindingSchema).default([]),
});

export const KgQaReportSchema = z.object({
  $schema: z.literal(KG_QA_SCHEMA),
  subject: z.object({
    kind: z.enum(KG_SUBJECT_KINDS),
    id: z.string().min(1),
    path: z.string().nullable(),
  }),
  source_hash: z.string().nullable(),
  criteria: z.record(z.string(), KgCriterionEntrySchema),
  totals: z.record(z.enum(KG_RESULTS), z.number()),
  // Refused, not merely dropped: a sidecar carrying a judgement is the mixed
  // file D2 split, and parsing it as clean would hide that it was written by
  // a writer that never learned about the store. See `schemas/sdlc/qa-attestations.ts`.
  pair_attestations: z.never({ error: "pair_attestations belong in the attestation store (schemas/sdlc/qa-attestations.ts), not a kg-qa sidecar" }).optional(),
  voice_reviews: z.never({ error: "voice_reviews belong in the attestation store (schemas/sdlc/qa-attestations.ts), not a kg-qa sidecar" }).optional(),
  adversarial_reviews: z.array(AdversarialReviewSchema).optional(),
  runContext: RunContextRefSchema.optional(),
});


export const KgQaManifestSchema = z.object({
  $schema: z.literal(KG_QA_MANIFEST_SCHEMA),
  auditor: z.object({
    script: z.string(),
    script_hash: z.string(),
    engine_version: z.string(),
  }),
  runContext: RunContextRefSchema.optional(),
});

/** Criteria applying to a subject kind, in registry order. */
export function criteriaFor(kind: KgSubjectKind): KgCriterionDefinition[] {
  return KG_CRITERIA.filter((c) => c.applies.includes(kind));
}

/**
 * Count outcomes. Written as a function rather than inline at each call site so
 * that a totals block can never disagree with the criteria block above it.
 */
export function tally(criteria: Record<string, KgCriterionEntry>): Record<KgResult, number> {
  const t: Record<KgResult, number> = { pass: 0, fail: 0, "n/a": 0, unknown: 0 };
  for (const e of Object.values(criteria)) t[e.result] += 1;
  return t;
}

/**
 * The worst severity among a report's failures — what a gate reads.
 *
 * **`unknown` counts, at the criterion's own severity.** A criterion that could
 * not be evaluated is a hole in the audit, not an absence of a problem, so it
 * is never quietly dropped. But it is not *promoted* either: promoting every
 * unknown to `major` would make an unevaluable `minor` criterion gate the
 * build, and a gate that fires on things nobody agreed were blocking is a gate
 * that gets switched off. A diagram that will not load records `unknown`
 * against its `critical` criteria too, so it still fails — which is the case
 * the promotion was reaching for.
 */
/**
 * The findings `kg:audit:check` grades in one report (bean `oqe3`): every
 * failing or unknown criterion at one of `gate`'s severities, one entry per
 * finding — or one for the criterion when it lists none. {@link worstSeverity}'s
 * rule (fail and unknown both count), kept exactly; per ENTRY rather than per
 * report, so a new finding in a subject that already had an old one is still
 * NEW against a baseline.
 */
export function gradedKgFindings(report: Pick<KgQaReport, "criteria">, gate: readonly KgSeverity[]): unknown[] {
  const out: unknown[] = [];
  for (const [id, e] of Object.entries(report.criteria ?? {})) {
    if (e.result !== "fail" && e.result !== "unknown") continue;
    const sev = KG_CRITERIA_BY_ID[id]?.severity;
    if (sev === undefined || !gate.includes(sev)) continue;
    if ((e.findings ?? []).length === 0) out.push({ criterion: id, result: e.result });
    for (const f of e.findings ?? []) out.push({ criterion: id, result: e.result, finding: f });
  }
  return out;
}

export function worstSeverity(report: KgQaReport): KgSeverity | undefined {
  let worst: KgSeverity | undefined;
  const rank: Record<KgSeverity, number> = { minor: 1, major: 2, critical: 3 };
  for (const [id, entry] of Object.entries(report.criteria)) {
    if (entry.result !== "fail" && entry.result !== "unknown") continue;
    const def = KG_CRITERIA_BY_ID[id];
    if (!def) continue;
    if (!worst || rank[def.severity] > rank[worst]) worst = def.severity;
  }
  return worst;
}
