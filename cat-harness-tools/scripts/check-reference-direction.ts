#!/usr/bin/env bun
/**
 * Nothing names a layer that depends on it: if sub1 depends (directly or
 * through a chain) on stub0, no reference or context points stub0 → sub1.
 *
 * The rule is `schemas/kg/reference-direction.ts`; the direction is
 * `schemas/kg/layer-direction.ts`, the same computation `check:partition`
 * uses. What is here is discovery, this layer's exemptions, and the
 * report.
 *
 * ## The repository-name collision ({@link collisionOf})
 *
 * The root layer's name is also the repository's name. Each occurrence is
 * classified by its shape (inside a URL, after an owner, before a path segment
 * into a directory the root DECLARES): `names-repository` for the repository
 * case, `undetermined` for the ambiguous residue. A file cannot exempt itself
 * by what it says about itself; like {@link GENERATOR_WRITTEN}, the decision
 * reads declarations, so a newly declared directory needs no edit here.
 *
 * ## The committed sidecar
 *
 * `cat-harness/test/results/reference-direction.qa-results.json` holds the
 * axis's answer in the `qa-results/v1` shape:
 *
 *  - **Verdict** counts (wrong-direction, exempt, `names-repository`,
 *    undetermined) are RECORDED, in {@link CENSUS_FAMILY}.
 *  - **File** counts (skipped, generator output, walked) are a census:
 *    printed, never recorded.
 *
 * The `wrong-direction` family records ONE entry per file and per layer
 * above it that the file names. It is in `failOnNew`, so `--check` is a
 * one-way ratchet: a pair the baseline does not hold fails, a pair that
 * disappears is resolved. The fix is to reword in place.
 *
 * ## `--check`
 *
 * Fails only on a graded **state** that is NEW against the baseline: a new
 * wrong-direction pair, an entry that no longer qualifies, a layer that
 * declares no `needs`. It never grades the verdict counts
 * ({@link comparableDirection} enforces this) and does not fail on the
 * backlog; the `✗` lines still print. The baseline is the `qa-reports` entry
 * `--against` names (CI passes `--against main`); without one the comparison
 * is UNKNOWN and not gated, so commit the regenerated sidecar in the same
 * change. `--check` never writes; the plain run is the writer.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/check-reference-direction.ts            # summary, and WRITE the sidecar
 *   … --findings           # every wrong-direction occurrence
 *   … --undetermined       # what it declined to judge, and why
 *   … --check              # do NOT write; fail ONLY on a graded state NEW against the baseline
 *   … --check --against R  # ...the baseline read from the qa-reports branch (`main`, `<sha>`, `pr/<n>`)
 *   … --strict             # exit 1 on any wrong-direction occurrence
 *
 * @module scripts/check-reference-direction
 * @covers computed — the set it reads is DERIVED from the declarations on the
 *   run in front of you: every declared directory whose graph typology is neither
 *   `state` nor `derived`, plus every file that has not declared itself
 *   generator output. Writing today's answer as a literal list of kinds would
 *   be the snapshot that goes stale silently, which is the failure this file
 *   already refuses for `GENERATOR_WRITTEN` and for every count in its own
 *   prose.
 */

import { HARNESS_ROOT } from "./lib/roots.ts";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import {
  BASE_GRAPH_TYPOLOGIES,
  findDeclarationFile,
  layerRootsIn,
  isDerivedGraph,
  isStateGraph,
  rootForScope,
} from "../schemas/kg/cat-harness.js";
import { ancestorsOf, flattenDependencies } from "../schemas/kg/dependency-order.js";
import { allowedFromNeeds, type LayerRule } from "../schemas/kg/layer-direction.js";
import {
  classifyReference,
  occurrencesOf,
  type NameCollision,
  type Occurrence,
  type ReferenceExemption,
  type ReferenceVerdict,
} from "../schemas/kg/reference-direction.js";
import { BEGIN as SUBGRAPH_README_BEGIN } from "@litlfred/bootstrap-tools/scripts/subgraph-readmes.ts";
import { aliasRoute, visualiserRoute } from "../schemas/kg/visualiser-route.js";
import { gateOwnInstances, gateOwnsFile } from "./lib/gate-own.ts";
import { overlayPath } from "./lib/layer-output.ts";
import { declaredVisualisers, forwardingParts, pageParts, siteOwnerDir } from "./viewer-declarations.js";
import { hostSiteArtefacts } from "./derive-at-publish.ts";
import {
  againstOrUsage,
  buildQaResult,
  judgeQaResult,
  judgeUsage,
  qaResultPath,
  writeQaResult,
  type QaResult,
} from "./qa-results.js";

const REPO_ROOT = join(import.meta.dir, "..", "..");
/**
 * The LAYER root, which is where the sidecar goes — never {@link REPO_ROOT}.
 *
 * `qaResultPath` mirrors this layer's `qa-results` declaration, and
 * `audit-coverage.ts` paid for getting this wrong: its first version wrote to
 * `<repo>/test/results/`, a directory no declaration names, so every consumer
 * scanning the declared graphs read a clean run over the one file it exists to
 * produce.
 */
const INSTANCE_ROOT = HARNESS_ROOT;

// ── What is scanned ─────────────────────────────────────────────
//
// Layer roots come from `layerRootsIn`, never from a glob and never
// from a list here: a literal written for this purpose on 2026-09-21 was
// silently missing six nodes (64 where the declaration resolves 70), and the
// run over it looked exactly like a complete one.
//
// The directories below are not declared graphs and no declaration would
// answer them — they are a checkout's machinery (`.git`, `node_modules`) or
// content this axis cannot read as a reference: `translations/` holds the
// same prose in other languages, so a name there is the ORIGINAL's reference
// counted again, once per locale.
// declared-path-literal: checkout machinery and per-locale copies of prose already counted at its source; none is a declared graph directory
const SKIP_DIRS = new Set([".git", "node_modules", "translations", ".claude"]);
/**
 * Kinds of graph whose contents a PROCESS writes.
 *
 * This is the generated-file question answered from the DECLARATION rather
 * than from a path or a marker, which is the only form of it this repository
 * accepts. `holds` is already on every graph typology and already means exactly
 * this: `content` is produced by authors, `context` is read and never
 * written, `state` is written by a running process as it runs, `derived` is
 * computed from something else.
 *
 * A name in machine output is not an authored reference. The rule is
 * `qa-checkers-dak.ts`'s, which this cannot import across the layer boundary
 * (`cat-harness` is depended on BY core, so importing core here would be the
 * very defect this file reports): *"A finding on a generated file is
 * unactionable — the fix is in the spreadsheet row or in the generator, and a
 * `fail` recorded against the artefact points at neither."*
 *
 * Its caution applies too — *"only an explicit marker counts. Inferring
 * 'generated' from a path or a naming convention would silently exempt
 * authored content"* — and a declaration is a stronger warrant than a marker,
 * not a weaker one: the layer SAYS what a process does with the directory,
 * and `check:graph-typology-work` already gates that it said something.
 *
 * Asked through `isStateGraph`/`isDerivedGraph` rather than by reading
 * `holds` directly, because those two are deliberately NOT each other's
 * negations and both are false for a kind the registry does not know. An
 * unregistered kind has said nothing, so the file is READ — the conservative
 * direction, since the cost of reading an excluded file is a finding somebody
 * dismisses, while the cost of excluding a read one is a leak nobody sees.
 *
 * A DIRECTORY is not the only unit this is declared at, and taking it as the
 * only one cost 429 false findings on the first run (2026-09-23): three
 * projections under `docs/` — `assets/{schemas,beans,voices}/index.json` —
 * are written by generators while sitting in a `content` graph, because the
 * directory holds documentation and these are files inside it. The FILE
 * family is declared too, and {@link GENERATOR_WRITTEN} reads that.
 */
/**
 * Every `$schema` a graph typology declares a GENERATOR writes.
 *
 * The second half of the machine-written question, at file granularity, and
 * read from the same declarations as the first — `nodeSchemas[…].generated`
 * in the graph-typology registry. Eight families across `docs` and `qa`.
 *
 * It read `writtenBy` until main removed that form (#1168 B6b, beans `dv8v`,
 * `d4lb`): the registry is a `@general` node, and naming each family's writer
 * named its dependents. `generated: true` says the same fact without the edge.
 * It is also STRICTER than what it replaced: `writtenBy` could name a
 * family's consumer, so `folio-intake/v1` — authored files that
 * `library-graph.ts` only reads — was skipped as if generated. It is now read.
 *
 * Derived rather than listed, and that is the point: the three projections
 * this was written for are `folio-schema-graph/v1`, `folio-bean-index/v1` and
 * `folio-voices-index/v1`, but listing those three would have left the other
 * six — and the tenth, the day somebody declares it — reporting as authored
 * prose. A literal written for exactly this purpose on 2026-09-21 was
 * silently missing six nodes; this is the same mistake one directory over.
 *
 * It also needs no change to any generator. The alternative considered was
 * having each of the three emit a `"_generated"` key, the way
 * `sync-docs-harness.ts` does: three edits, three regenerated artefacts, and
 * a convention a fourth generator would have to remember. The declaration
 * already says it, so nothing needs to start saying it again.
 */
const GENERATOR_WRITTEN: ReadonlySet<string> = new Set(
  Object.values(BASE_GRAPH_TYPOLOGIES).flatMap((k) =>
    Object.entries(k.nodeSchemas ?? {})
      .filter(([, d]) => (d as { generated?: true }).generated === true)
      .map(([schema]) => schema),
  ),
);

/**
 * Does the file SAY a generator wrote it, in its own first lines?
 *
 * Two conventions in the corpus, both self-declarations rather than
 * inferences from a path:
 *
 *  - a top-level `"_generated"` key in JSON — `sync-docs-harness.ts` into
 *    `docs/_data/harness.json` all along, and `glossary-page.ts` into the
 *    SKOS assets and the extracted glossary schemes (bean `ws99`);
 *  - a `generated:` front-matter key in Markdown — `gen-skill-docs.ts` and
 *    `gen-schema-docs.ts` into the `docs/reference/**` mirrors (#1222),
 *    `gen-uml-overview.ts` into `docs/uml/`, and `glossary-page.ts` and
 *    `gen-docs-pages.ts` into their own pages (`ws99`).
 *
 * No count of either: the summary line prints how many files take this route
 * on the run in front of you, and a number written down here is a claim about
 * a corpus that changes whenever a generator gains a page. This paragraph
 * carried two such numbers and both were stale within four days.
 *
 * The mirrors are the clearest case for reading a declaration rather than a
 * path: each is a COPY of a skill that sits one directory away, so a finding
 * on one is the same finding twice and its fix is in neither — it is in the
 * source skill. AGENTS.md has forbidden hand-editing them since before this
 * check existed; the files simply never said so themselves.
 *
 * Front matter only, and only the first lines: a page that DISCUSSES
 * generation must not be able to exempt itself by mentioning the word.
 *
 * JSON is read the way {@link isGeneratorWritten} reads it — PARSED, and
 * `_generated` taken from the top level wherever it sits. It was a regex
 * anchored to the first key until bean `ws99`, which is a different rule than
 * the one this docblock states: it made POSITION part of the contract, so a
 * file whose first key is `$schema` or `@context` could not declare itself
 * without moving the key that says what it IS. Both are worth keeping first —
 * `$schema` because every validator looks for it there, `@context` because a
 * JSON-LD reader does — so the position requirement cost the declaration
 * rather than buying anything. The principle the regex was defending is
 * unchanged and is met better by parsing, in the words of this file's own
 * {@link isGeneratorWritten}: *"Parsing and reading the top level is the
 * difference between what a file IS and what it mentions."* A `_generated`
 * nested inside a projection of another file is still not this file's
 * declaration, and a whole-text scan would have read it as one.
 *
 * Markdown keeps the head-only front-matter route unchanged: there is no
 * top level to read in prose, so the first lines are the only place a page
 * can speak about itself rather than about its subject.
 */
export function declaresGenerated(abs: string): boolean {
  let text: string;
  try {
    text = readFileSync(abs, "utf-8");
  } catch {
    return false;
  }
  if (abs.endsWith(".json") || abs.endsWith(".jsonld")) {
    try {
      const top = JSON.parse(text) as unknown;
      if (typeof top !== "object" || top === null || Array.isArray(top)) return false;
      return (top as { _generated?: unknown })._generated !== undefined;
    } catch {
      return false; // unparseable is not a licence to skip it
    }
  }
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text.slice(0, 2000));
  return fm !== null && /^generated:\s*\S/m.test(fm[1]!);
}

/**
 * Is this file one a generator writes, by its own `$schema`?
 *
 * Only a TOP-LEVEL `$schema` counts. `docs/assets/schemas/index.json` carries
 * the string `generatedAt` four times deeper in — as a FIELD NAME inside a
 * schema projection — so a marker scan over the text says "generated" about
 * any file that describes a generated one. Parsing and reading the top level
 * is the difference between what a file IS and what it mentions.
 */
function isGeneratorWritten(abs: string): boolean {
  if (!abs.endsWith(".json") && !abs.endsWith(".jsonld")) return false;
  try {
    const top = JSON.parse(readFileSync(abs, "utf-8")) as unknown;
    if (typeof top !== "object" || top === null || Array.isArray(top)) return false;
    const schema = (top as { $schema?: unknown }).$schema;
    return typeof schema === "string" && GENERATOR_WRITTEN.has(schema);
  } catch {
    return false; // unparseable is not a licence to skip it
  }
}

/** Text this axis can read. A binary or an image carries no reference a reader follows. */
const EXTENSIONS = new Set([".ts", ".tsx", ".md", ".json", ".jsonld", ".bpmn", ".dmn", ".yml", ".yaml"]);

/**
 * X3 — the LAYERING SPECIFICATIONS (owner, Q-B 2026-10-01: "adopt the X3
 * exemption for the 3 layering specifications").
 *
 * Each of these files has the instance graph as its SUBJECT: it is the
 * document or the code that DEFINES which layer sits on which layer, so it
 * cannot do its job without naming the layers above it. Moved to any one
 * layer it could no longer describe the others — the 2026-09-24 PENDING
 * rationale, now ruled rather than held. A named list, never a pattern: a
 * file earns a place here only by an owner ruling, and a regex would admit
 * the next file that merely resembles one.
 *
 * This file is one of the three. Until the ruling it sat in its own PENDING
 * list, on the argument that a carve made by the checker for the checker is
 * the one nobody else can audit; the ruling answers that by being the
 * owner's carve rather than the checker's, and it is counted in the summary
 * like every other exemption.
 */
// declared-path-literal: the three files the owner's X3 ruling names, repo-root-relative because that is how an occurrence's file is reported
const LAYERING_SPECIFICATIONS = [
  "cat-harness-tools/scripts/partition/instance-rules.ts",
  "smart-base/skills/content/authoring-who-smart-guidelines/smart-stack-layering.md",
  "cat-harness-tools/scripts/check-reference-direction.ts",
] as const;

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * X5 — a DATED DECISION RECORD (owner, 2026-10-14, Q1 of the #2529
 * reference-direction review: "Exempt as records").
 *
 * A proposal under a layer's `docs/proposals/` whose file name ends in the
 * date it was written (`<topic>-YYYY-MM-DD.md`, or the `.json` measurement it
 * carries) is a RECORD: it states the options, the measurements and the
 * layering as they stood on that day, and the owner answered it as written.
 * Rewording it afterwards so that it no longer names a higher layer would
 * falsify what was asked and what was decided — the same reason X3 leaves the
 * layering specifications naming the layers they define.
 *
 * Deliberately narrow, and each half is held by a test:
 *
 *  - **dated** — the file name must END in `-YYYY-MM-DD`. The undated pages
 *    beside them (`index.md`, `README.md`, a proposal still being argued
 *    without a date) are living documents, edited as the answer changes, and
 *    stay `wrong-direction` — except the generated index's ROW for a dated
 *    record, which {@link DATED_PROPOSAL_INDEX_ROW} reads as the record.
 *  - **a proposal** — directly under `docs/proposals/` of a layer root,
 *    not in a sub-directory and not in any other `docs/` section.
 *
 * A pattern rather than a named list, unlike X3, because the owner ruled on
 * the CLASS ("dated decision records"), not on three files: every dated record
 * written later is the same kind of thing for the same reason.
 */
/** The FILE NAME of a dated record: `<topic>-YYYY-MM-DD.md`, or the `.json` measurement it carries. */
const DATED_RECORD_NAME = String.raw`[a-z0-9][a-z0-9-]*-\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\.(?:md|json)`;
// declared-path-literal: the directory dated proposal records sit in, repo-root-relative because that is how an occurrence's file is reported
const PROPOSALS_DIR = String.raw`[a-z0-9][a-z0-9-]*\/docs\/proposals\/`;
const DATED_PROPOSAL_RECORD_FILE = new RegExp(`^${PROPOSALS_DIR}${DATED_RECORD_NAME}$`);
export const DATED_PROPOSAL_RECORD: ReferenceExemption = {
  file: DATED_PROPOSAL_RECORD_FILE,
  reason:
    "X5, a DATED DECISION RECORD (owner, 2026-10-14, Q1: \"Exempt as records\"): a proposal whose file name carries the date it was written records the layering, the options and the measurements as they stood that day, and the owner answered it as written. Rewording it to stop naming a higher layer would falsify the record. Dated files directly under an instance's `docs/proposals/` only; the undated index and living pages beside them are read",
};

/**
 * X5, applied to the INDEX of the records (owner, 2026-10-16, item 6a of the
 * folio-assistant#2598 wrong-direction triage: the generated index that lists
 * the dated records gets the same records treatment as the records).
 *
 * The `README.md` beside the records is written by the bootstrap toolset's
 * `subgraph-readmes.ts`, which lists every file of the directory as a table
 * row: the file's name, linked to itself, then the title it carries. A row
 * for a dated record therefore repeats the record — its file name and its
 * title, both of which may name the layer the record was written about — and
 * the only ways to stop the row naming that layer are to rename the record
 * (breaking every link to it) or to reword its title (falsifying it), which
 * is what X5 forbids.
 *
 * Narrow on three axes, each held by a test:
 *
 *  - **declared** — the FILE declares itself the generator's index: it carries
 *    `subgraph-readmes.ts`'s own region marker ({@link SUBGRAPH_INDEX_BEGIN}).
 *    Decided per file in {@link analyse}, like {@link TRANSLATION_MIRROR}, by
 *    what the file says about itself rather than by its name; a hand-written
 *    page beside the records is never consulted against this entry.
 *  - **beside the records** — a Markdown file directly in a directory where
 *    X5 applies, so the rows it lists are X5's records and nothing else.
 *  - **a row for a dated record** — the line is a table row whose first cell
 *    is a dated record's name linked to itself (`| [`<name>`](<name>) |`),
 *    the shape the generator writes. The rows for undated, living proposals
 *    and every line of prose on the page are read as before.
 */
export const SUBGRAPH_INDEX_BEGIN = SUBGRAPH_README_BEGIN;
export const DATED_PROPOSAL_INDEX_ROW: ReferenceExemption = {
  file: new RegExp(`^${PROPOSALS_DIR}[^/]+\\.md$`),
  pattern: new RegExp(`^\\| \\[\`(${DATED_RECORD_NAME})\`\\]\\(\\1\\) \\|`),
  reason:
    "X5 applied to the generated INDEX of dated records (owner, 2026-10-16, item 6a): the file declares itself `subgraph-readmes.ts`'s index of the directory, and the row lists one dated record by its own file name and title. The row repeats the record, so it names what the record names; renaming the record would break its links and rewording its title would falsify it. Rows for undated proposals, and the page's prose, are read",
};

/** Does the file declare itself the bootstrap toolset's generated index of its directory? */
export function declaresSubgraphIndex(abs: string): boolean {
  if (!abs.endsWith(".md")) return false;
  try {
    return readFileSync(abs, "utf-8").includes(SUBGRAPH_INDEX_BEGIN);
  } catch {
    return false;
  }
}

/**
 * 3a — a WORKFLOW `uses:` ADDRESS (owner, 2026-10-15, ruling "3a" of the
 * folio-assistant#2529 reference-direction review).
 *
 * A layer's pull-request CI calls ONE reusable workflow that a higher layer
 * keeps — `uses: <owner>/cat-harness-tools/.github/workflows/layer-pr-checks.yml@main`
 * in `cat-harness`, `bootstrap` and `bootstrap-tools`. The owner ruled that
 * line names a REPOSITORY ADDRESS — where GitHub fetches the workflow from —
 * not a dependency of the calling layer on the layer that shares the
 * repository's name. Nothing in the caller's tree loads, imports or runs a
 * file of that layer; the hosting service resolves the address.
 *
 * Why an exemption and not `names-repository`: that verdict is what
 * {@link analyse}'s `collisionOf` returns for the ROOT layer's name, the one
 * that collides with the checkout's own repository, and it is consulted for no
 * other target. Widening the resolver to every layer would change what it
 * answers (and what its tests hold) for a carve the owner ruled on one shape
 * of; an exemption carries the ruling as its reason and is counted on its own
 * line, as X3/X4/X5 are.
 *
 * Narrow on three axes, and each edge is held by a test:
 *
 *  - **file** — a GitHub Actions workflow: a `.yml`/`.yaml` file directly in
 *    a `.github/workflows/` directory (of any layer, or of the repository
 *    root). Not a composite action's `action.yml`, not a workflow template
 *    under `templates/`, and not Markdown that QUOTES a `uses:` line.
 *  - **key** — the line is the `uses:` key of a job or of a step (`uses:` or
 *    `- uses:`), and nothing else: `run:`, `with:`, `repository:`, `path:` and
 *    comments are read as before, including a `run:` that executes the higher
 *    layer's scripts and a checkout `path:` that names it.
 *  - **value** — the WHOLE value is a remote address,
 *    `<owner>/<repo>[/<path>]@<ref>`, optionally quoted, optionally followed by
 *    a version comment (`# v4.1.1`) and nothing else. A local action
 *    (`./<path>`) is a path in the checkout, and a `docker://` image is not a
 *    repository; both stay read.
 */
// declared-path-literal: the shape of a GitHub Actions workflow file, repo-root-relative because that is how an occurrence's file is reported
const WORKFLOW_FILE = /^(?:[A-Za-z0-9_.-]+\/)*\.github\/workflows\/[^/]+\.ya?ml$/;
/** `<owner>/<repo>[/<path>]@<ref>` — GitHub's address of a reusable workflow or an action. */
const REMOTE_USES_ADDRESS = String.raw`[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*@[A-Za-z0-9_.\/-]+`;
export const WORKFLOW_USES_ADDRESS: ReferenceExemption = {
  file: WORKFLOW_FILE,
  pattern: new RegExp(
    String.raw`^(?:-\s+)?uses:\s+(["']?)${REMOTE_USES_ADDRESS}\1(?:\s+#\s*v?\d[A-Za-z0-9_.+-]*)?\s*$`,
  ),
  reason:
    "3a, a WORKFLOW `uses:` ADDRESS (owner, 2026-10-15, ruling \"3a\"): a GitHub Actions `uses: <owner>/<repo>[/<path>]@<ref>` names the REPOSITORY a reusable workflow or action is fetched from, not a dependency on the layer sharing that repository's name. Only the `uses:` key of a job or step in a `.github/workflows/` file, and only when the whole value is such an address; `run:`, checkout paths and every other key are read",
};

/**
 * X4 — a DEFINITION NAMING ITS IMPLEMENTATION (owner, 2026-10-11T05:58:12Z,
 * session_01UC1NuEuSy1MBNpEhnDuiGj: "2 y", ruling (ii) — *"rule that a harness
 * skill may name a cat-harness-tools script"*).
 *
 * `cat-harness-tools/AGENTS.md`'s one rule is *"definitions there,
 * implementations here"*: the harness holds the contract and the method, the
 * tools layer holds the code that runs it (bean `w2gr`, option A). A skill —
 * or any other Markdown in the harness that tells an agent what to run — has
 * to say WHICH script carries the method out, and since bean `70lx` moved the
 * harness's code down a layer that script's path starts with the name of the
 * layer above. That is the split working, not a dependency of the definition
 * on its implementation: the definition is complete without the script, and
 * the line is an instruction to the reader.
 *
 * Deliberately narrow, on three axes, each held by a test:
 *
 *  - **file** — Markdown under `cat-harness/` only. Code and configuration
 *    (`.ts`, `.json`, `.yml`) that names a tools script RUNS it or imports it,
 *    which is a real dependency, and stays `wrong-direction`.
 *  - **target** — `cat-harness-tools` only. A skill naming any other layer
 *    above it is unaffected.
 *  - **line** — EVERY occurrence of the name on the line must be a script or
 *    command path: a path under a `scripts/` directory of the tools layer, or
 *    the file a `bun run` command line executes. A line that also names the
 *    tools layer's source (`src/`, `test/`, …) or the layer as such is not
 *    excused by the script beside it — the regex is anchored to the whole
 *    line for that reason.
 */
const TOOLS_NAME = "cat-harness-tools";
const NAME_BOUND = `(?<![A-Za-z0-9_-])${escapeRe(TOOLS_NAME)}(?![A-Za-z0-9_-])`;
const PATH_CHARS = "[A-Za-z0-9_.-]";
/**
 * A path separator: `/`, or `\` in the Windows form a cmd.exe or PowerShell
 * line needs (`.\cat-harness-tools\scripts\bootstrap.ps1`;
 * folio-assistant#2681).
 */
const SEP = "[/\\\\]";
/** A path inside a `scripts/` directory of the tools layer, at any depth. */
const TOOLS_SCRIPT_PATH = `(?<![A-Za-z0-9_-])${escapeRe(TOOLS_NAME)}${SEP}(?:${PATH_CHARS}+${SEP})*?scripts${SEP}(?:${PATH_CHARS}+(?:${SEP}${PATH_CHARS}+)*)?`;
/** The file a `bun run` command executes, optionally behind a `<platform>/` or `./` prefix. */
const TOOLS_COMMAND_PATH = `(?<=\\bbun run (?:<[a-z-]+>/|\\./)?)${escapeRe(TOOLS_NAME)}/(?:${PATH_CHARS}+/)*${PATH_CHARS}+\\.(?:ts|js|mjs|sh|py)(?![A-Za-z0-9_])`;
export const DEFINITION_NAMES_IMPLEMENTATION: ReferenceExemption = {
  file: /^cat-harness\/.+\.md$/,
  to: TOOLS_NAME,
  pattern: new RegExp(`^(?:${TOOLS_SCRIPT_PATH}|${TOOLS_COMMAND_PATH}|(?!${NAME_BOUND})[\\s\\S])*$`),
  reason:
    "X4, a DEFINITION NAMING ITS IMPLEMENTATION (owner, 2026-10-11T05:58:12Z, ruling (ii): \"a harness skill may name a cat-harness-tools script\"): Markdown in the harness telling an agent which tools script to run — \"definitions there, implementations here\" (cat-harness-tools/AGENTS.md). Markdown only, the tools layer only, and only when every mention on the line is a script or command path",
};

/**
 * X4, WIDENED — a definition POINTING AT its implementation, which nothing
 * runs (owner, 2026-10-14, Q6 of the folio-assistant#2529
 * reference-direction review: "(a)", widen X4).
 *
 * Ruling (ii) above excused one shape of the split: a harness Markdown line
 * naming the tools SCRIPT an agent should run. The same split also shows up
 * as a pointer that is not a script and not in Markdown — a skill naming the
 * `src/` module that implements what it defines, a schema's comment naming the
 * tools file that writes the shape it declares, a requirement or an actor's
 * `description` naming the code it describes. The owner ruled those the same
 * kind of thing: the definition is complete without them, and the line tells
 * a reader where the implementation lives. Nothing loads, imports or executes
 * it, which is the whole difference between a pointer and a dependency.
 *
 * Narrow on the same axes as X4, and each edge is held by a test:
 *
 *  - **from / to** — a file under `cat-harness/` naming `cat-harness-tools`,
 *    and no other pair. The "definitions there, implementations here" split
 *    is between exactly these two layers.
 *  - **what counts as a pointer** — a path INTO the tools layer's code
 *    (`cat-harness-tools/<dir>/…`, at least one directory deep, never its
 *    `test/` material and never a root file such as its `package.json`); the
 *    layer named beside a code file (`cat-harness-tools \`x.ts\``, or
 *    `\`x.ts\` (cat-harness-tools)`); and, in Markdown only, a parenthetical
 *    that wraps onto the next line straight after the layer's name. The layer
 *    named AS SUCH — in a list of repositories, as a subject doing something —
 *    is not a pointer and stays read.
 *  - **never executed** — the mention may not be the argument of a command
 *    (`run`, `test`, `python3`, `bash`, `node`, …) or of an import (`from "…"`,
 *    `import("…")`, `require("…")`), and may not be glued to a longer path
 *    (`/abs/…/cat-harness-tools/…`, `../cat-harness-tools/…`), which is what a
 *    command line or a loader resolves. Per file type, the line must be one
 *    nothing runs: in TypeScript a COMMENT line (and not a `/// <reference>`
 *    or an `import()` type); in JSON a PROSE field (`description`,
 *    `requirement`, `rationale`, a `_comment`, …) or a bare array element that
 *    is a sentence; Markdown is prose throughout, with the command and import
 *    refusals above.
 *  - **line** — EVERY mention on the line must be one of these, as in X4: a
 *    pointer does not excuse a real reference beside it.
 *
 * Three entries, one per file type, because a line rule cannot see the file
 * type and each type has a different answer to "which lines does nothing
 * run". Each is counted under its own reason, so how much each carve does is
 * visible in the summary.
 */
/** Characters a path segment may hold in a pointer: X4's, plus the `*` of a glob. */
const POINTER_PATH_CHARS = "[A-Za-z0-9_.*-]";
/** A mention that is the argument of a command or an import is executed or loaded, never a pointer. */
const NOT_EXECUTED = `(?<!\\b(?:run|test|exec|python3?|bash|sh|node|bunx|npx|deno|source|from|import)\\s+["'\`]?)(?<!\\b(?:require|import)\\(\\s*["'\`]?)`;
/** The name, not glued to a longer path on its left (`/abs/…/<name>`, `../<name>`). */
const POINTER_NAME = `${NOT_EXECUTED}(?<![A-Za-z0-9_./-])${escapeRe(TOOLS_NAME)}(?![A-Za-z0-9_-])`;
/** A code file, optionally in a code span. A test file is not where a definition is implemented. */
const IMPLEMENTATION_FILE = `\`?(?!(?:test|tests|__tests__)/)(?:${PATH_CHARS}+/)*(?!${PATH_CHARS}*\\.(?:test|spec)\\.)${PATH_CHARS}+\\.(?:ts|tsx|js|mjs|py|sh)(?![A-Za-z0-9_])\`?`;
/** `cat-harness-tools/<dir>/…` — at least one directory deep, never into its test material. */
const TOOLS_IMPLEMENTATION_PATH = `${POINTER_NAME}/(?!(?:test|tests|__tests__)/)${PATH_CHARS}+/(?:${POINTER_PATH_CHARS}+(?:/${POINTER_PATH_CHARS}+)*/?)?`;
/** `cat-harness-tools \`x.ts\`` and `(cat-harness-tools src/x.ts)`. */
const LAYER_BESIDE_FILE = `${POINTER_NAME}[ \\t]+${IMPLEMENTATION_FILE}`;
/** `\`x.ts\` (cat-harness-tools)`. */
const FILE_BESIDE_LAYER = `${IMPLEMENTATION_FILE}[ \\t]+\\(${POINTER_NAME}\\)`;
const POINTERS = `${TOOLS_IMPLEMENTATION_PATH}|${LAYER_BESIDE_FILE}|${FILE_BESIDE_LAYER}`;
/** The rest of the line, with every mention on it a pointer (or one of `extra`). */
const ONLY_POINTERS = (extra = ""): string => `(?:${extra}${POINTERS}|(?!${NAME_BOUND})[\\s\\S])*$`;
const POINTS_REASON = (where: string): string =>
  `X4 WIDENED, a DEFINITION POINTING AT ITS IMPLEMENTATION (owner, 2026-10-14, Q6: "(a)", widen X4): ${where} in the harness naming where in cat-harness-tools the thing it defines is implemented — a pointer nothing imports, loads or runs. Only when every mention on the line is such a pointer: a path into the tools layer's code (not its tests), or the layer named beside a code file; never the argument of a command or an import`;

export const DEFINITION_POINTS_TO_IMPLEMENTATION_MD: ReferenceExemption = {
  file: /^cat-harness\/.+\.md$/,
  to: TOOLS_NAME,
  // X4's script and command paths stay excused on the same line, and a
  // Markdown parenthetical may wrap straight after the layer's name.
  pattern: new RegExp(`^${ONLY_POINTERS(`${TOOLS_SCRIPT_PATH}|${TOOLS_COMMAND_PATH}|\\(${POINTER_NAME}$|`)}`),
  reason: POINTS_REASON("Markdown"),
};

export const DEFINITION_POINTS_TO_IMPLEMENTATION_TS: ReferenceExemption = {
  file: /^cat-harness\/.+\.tsx?$/,
  to: TOOLS_NAME,
  // A comment line, trimmed as `analyse` reports it; never a triple-slash
  // directive or an `import()` / `require()` type, which a compiler resolves.
  pattern: new RegExp(`^(?:\\/\\/(?!\\/)|\\/\\*|\\*)(?![\\s\\S]*(?:\\bimport\\s*\\(|\\brequire\\s*\\(|<reference\\b))${ONLY_POINTERS()}`),
  reason: POINTS_REASON("a TypeScript comment"),
};

/** JSON keys whose value is prose for a reader — never a command, a path a tool reads, or an identifier. */
const PROSE_KEY = `"(?:description|requirement|rationale|reason|note|notes|summary|statement|gloss|\\$comment|_?[A-Za-z]*_?comment)"\\s*:\\s*"`;
/** A bare array element that is a sentence: it ends in a full stop, which no command or path does. */
const SENTENCE_ELEMENT = `"(?=(?:[^"\\\\]|\\\\.)*[.!?]"\\s*,?$)`;
export const DEFINITION_POINTS_TO_IMPLEMENTATION_JSON: ReferenceExemption = {
  file: /^cat-harness\/.+\.json$/,
  to: TOOLS_NAME,
  pattern: new RegExp(`^(?:${PROSE_KEY}|${SENTENCE_ELEMENT})${ONLY_POINTERS()}`),
  reason: POINTS_REASON("a JSON prose field"),
};

// ── This layer's exemptions ──────────────────────────────────
//
// Same contract as `iwtn`'s `ALLOW`: each entry states WHY the text is not a
// reference to the layer whose name it contains. A regex with no reason is
// a hole, and these are COUNTED in the summary rather than disappearing, so
// an exemption doing more work than anyone intended is visible.

/**
 * A layer's `uploads/` is its data store, not part of the KG (owner,
 * 2026-11-03, bean folio-assistant-djj5), so its intakes are not references.
 */
export const INSTANCE_UPLOADS_DATA: ReferenceExemption = {
  file: /(^|\/)uploads\//,
  reason:
    "an instance's UPLOADS data store. Owner, 2026-11-03: *\"instantiated harnesses can have an uploads/ but that is data store for that repo, not part of the KG\"*. An intake records where a capture came from and who cited it (a DAK's reference list, the repository it moved from), which names other instances as provenance, not as a dependency; while `uploads/` was declared it was a state graph this axis never read, and an undeclared one is the same data",
};

/**
 * A document's provenance log, `<document>.prov.jsonld`, quotes verbatim
 * where a rule came from (owner, 2026-11-05, decision card "A. Exempt logs").
 */
export const PROVENANCE_LOG: ReferenceExemption = {
  file: /\.prov\.jsonld$/,
  reason:
    "a PROVENANCE LOG: `<document>.prov.jsonld` quotes verbatim where a rule came from (the owner, an issue, a PR, an earlier state), so it names the instances those words named. It is a record of origin, not a reference the document depends on. Owner, 2026-11-05, decision card: *\"A. Exempt logs\"*, keeping the quotes verbatim. The rule is in `skills/conduct/conduct-core/symbiotic-interaction.md`",
};

const EXEMPTIONS: readonly ReferenceExemption[] = [
  INSTANCE_UPLOADS_DATA,
  PROVENANCE_LOG,
  {
    pattern: /https?:\/\/\S+/,
    reason:
      "the occurrence sits on a line carrying a URL — an ADDRESS, not a reference. `iwtn`'s ALLOW makes exactly this carve for bootstrap's own publication address and source repository: a location is where a thing is, not a dependency on it",
  },
  {
    pattern: /(?<![A-Za-z0-9_-])[a-z][a-z0-9-]*:[A-Za-z][A-Za-z0-9]*/,
    reason:
      "a CURIE — `<prefix>:<Term>`, the compact form of a schema identifier. The owner's ruling the same day: nothing should point outside its subgraph *\"except SDO schema definitions (e.g. OMG:bpmn....)\"*, and `iwtn`'s ALLOW already carves the `folio:` BPMN prefix and `folio-*/v1` schema ids on that basis. A vocabulary term is a NAME, and a name that happens to share a string with an instance is not a reference to it",
  },
  {
    file: /(^|\/)(test|tests|__tests__)\/|\.(test|spec)\.tsx?$|(^|\/)eval\//,
    reason:
      "TEST MATERIAL. Not a carve invented here — it is the rule the import axis already applies, stated in `partition/instance-rules.ts`: *\"A test may reach anywhere it needs to; that is what a test is for.\"* A fixture naming a downstream instance is exercising the layering, not depending on it, and the two axes agreeing on this is the point of absorbing one into the other. `check:partition` buckets 486 modules as `(test material)` on the same ground",
  },
  {
    pattern: /^\s*"(?:[^"\/]+\/)*(test|tests|__tests__)\/[^"]*",?\s*$/,
    reason:
      "a PATH INTO TEST MATERIAL, alone on its line as a quoted string (a file list such as the content-code-free ratchet). The instance name is a directory inside a test fixture, so the line points at the fixture, which the TEST MATERIAL rule above already exempts; listing a fixture's path is not depending on the instance its folder is named after",
  },
  {
    pattern: /^\s*(\/\/|\*|#)?\s*declared-path-literal:/,
    reason:
      "`check:declared-paths`'s own exemption marker, whose reason text necessarily names the directory it is excusing. Scanning it would make satisfying one gate breach another",
  },  {
    file: new RegExp(`^(${LAYERING_SPECIFICATIONS.map(escapeRe).join("|")})$`),
    reason:
      "X3, a LAYERING SPECIFICATION (owner, Q-B 2026-10-01): the file's subject IS the instance graph — it defines the layers, so it names them. Moved to any one layer it could no longer describe the others. A named list of three, ruled by the owner, never a pattern",
  },  DEFINITION_NAMES_IMPLEMENTATION,
  DEFINITION_POINTS_TO_IMPLEMENTATION_MD,
  DEFINITION_POINTS_TO_IMPLEMENTATION_TS,
  DEFINITION_POINTS_TO_IMPLEMENTATION_JSON,
  DATED_PROPOSAL_RECORD,
  WORKFLOW_USES_ADDRESS,
];

/**
 * Known wrong-direction references awaiting the owner's ruling.
 *
 * `iwtn`'s `PENDING`, generalised: a leak nobody has ruled on yet is made
 * VISIBLE rather than silent. Every entry is a FILE, with the number of
 * distinct layers it names, and it earns its place by ONE property —
 * **it names more than one layer above it, so "move it up" has no single
 * destination.**
 *
 * That is the whole membership rule, and it is mechanical: `names > 1`. It
 * is checked, not asserted — an entry whose file has dropped to one target
 * is reported stale, the same as one with no findings left.
 *
 * ## Why these are pending rather than exempt
 *
 * The owner ruled on 2026-09-24 that naming is naming: a lower layer may
 * not name a higher one, and the fix is to move the file up. For the 117
 * files that name exactly one layer that is a well-defined instruction.
 * For these 50 it is not, and the reasons differ by kind:
 *
 *  - **Declarations and registries** — `cat-harness.json` names
 *    `folio-assistant-core/schemas/` BECAUSE IT DECLARES THAT DIRECTORY.
 *    Moving it up does not remove the reference; it removes the
 *    declaration. Same for `avatars.ts`, `ig-chrome.ts`, `graph-typology-
 *    registry.ts`, `namespaces.ts` — registries keyed by instance.
 *  - **Specifications about the layering** — `instance-rules.ts`,
 *    `smart-stack-layering.md` and this file. RULED since (owner, Q-B
 *    2026-10-01, X3): they left this list for {@link LAYERING_SPECIFICATIONS},
 *    an exemption, because their subject IS the instance graph.
 *  - **Prose naming two or more** — a genuine choice between destinations
 *    that nobody has made.
 *
 * Grouping them by kind here would be a judgement this list has no standing
 * to make: the owner's ruling settles the single-destination case and
 * explicitly did NOT settle this one, so the honest record is the mechanical
 * fact (`names`) plus the count, not a category somebody could mistake for a
 * decision. Issue #1219.
 *
 * **It compares as a SET.** A new multi-target file fails, and so does a
 * FIXED one — a PENDING that only grows stops meaning anything.
 *
 * That half fired on bean `ws99`, which is the first evidence it works.
 * `cat-harness/docs/fhir/ig-publisher.md` and `cat-harness/docs/process/publication-workflow.md`
 * were held here as prose naming two or three layers with no single
 * destination. They are not prose: `gen-docs-pages.ts` writes both, and once it
 * began saying so in their front matter they stopped being read at all. Their
 * entries were DELETED rather than left, because an entry recording a choice
 * nobody has to make any more is a question the owner would be asked twice.
 * Neither file was edited to earn that — the generator was.
 *
 * The second time: `cat-harness/docs/en/cat-harness/processes/index.md`,
 * held here naming four layers, is `gen-processes-viz.ts`'s, and left when
 * that generator began writing `generated:` into every page it draws
 * (folio-assistant#2529, PR 3 of the reference-direction batch).
 *
 * The third: `cat-harness/docs/en/cat-harness/methodologies/index.md`, held
 * naming three, is `gen-methodologies-viz.ts`'s, and left when that generator
 * — with `gen-tools-viz.ts` and `gen-lsi-viz.ts` — began writing `generated:`
 * (D1 aftermath, 2026-10-15). `cat-harness/docs/cat-harness/published-graphs.md`
 * left the same day: nothing in it names a layer above any more. The six
 * fhir-harness entries left on 2026-10-20: fhir-harness#118 moved its module
 * paths under `pipeline/`, and none of the six names a layer above any more.
 * Core's `figure-rebuild.md` skill left on 2026-11-02: folio-assistant-core#569
 * says "the L1 library entry" and "the FHIR layer" instead of naming them.
 */
const PENDING: readonly { file: string; names: number }[] = [];

/**
 * X1 — a TRANSLATION MIRROR (owner, Q-B 2026-10-01: "exempt translation
 * mirrors").
 *
 * The existing `SKIP_DIRS` rule applied consistently rather than a new carve:
 * `translations/` is skipped because a name there is the ORIGINAL's reference
 * counted again, once per locale. The locale copies under `docs/<lang>/` and
 * `docs/guides/<lang>/` are the same thing in another place, so a reference in
 * one is fixed in its English source and re-translated, never in the copy.
 *
 * Decided by what the FILE declares, never by its path: front matter carrying
 * a `lang:` other than `en` AND a `translation_source:`. Both, because `lang:`
 * alone is on every English source page too, and a page that merely mentions
 * translation must not be able to exempt itself — the same head-only reading
 * {@link declaresGenerated} uses. Applied per file in {@link analyse} and
 * consulted LAST, so any other exemption that matches keeps its own reason.
 */
const TRANSLATION_MIRROR: ReferenceExemption = {
  file: /(?:)/,
  reason:
    "X1, a TRANSLATION MIRROR (owner, Q-B 2026-10-01): the file's front matter declares a non-English `lang:` and a `translation_source:`, so every name in it is its source page's reference counted again — the reason `translations/` is skipped. Fixed in the source and re-translated, never in the copy",
};

/** How many exemptions this axis declares, each with a stated reason — {@link EXEMPTIONS} plus the two applied per file, {@link TRANSLATION_MIRROR} and {@link DATED_PROPOSAL_INDEX_ROW}. */
export const EXEMPTIONS_DECLARED = EXEMPTIONS.length + 2;

/** Does the file declare itself a translation of another page, in its own front matter? */
export function declaresTranslationMirror(abs: string): boolean {
  if (!abs.endsWith(".md")) return false;
  let text: string;
  try {
    text = readFileSync(abs, "utf-8");
  } catch {
    return false;
  }
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text.slice(0, 4000));
  if (fm === null) return false;
  const lang = /^lang:\s*["']?([A-Za-z-]+)["']?\s*$/m.exec(fm[1]!)?.[1];
  return lang !== undefined && lang.toLowerCase() !== "en" && /^translation_source:\s*\S/m.test(fm[1]!);
}

// ── Discovery ───────────────────────────────────────────────────

interface Instance {
  root: string;
  name: string;
  needs: readonly string[] | undefined;
  /** Absolute paths this layer declares as holding machine-written graphs. */
  machineWritten: string[];
  /**
   * The directory paths this layer DECLARES, exactly as declared — relative
   * segments like `uploads/` or `tools/`, not absolute and not resolved.
   *
   * Unresolved on purpose, because what they answer is a question about TEXT:
   * given an occurrence of this layer's name, does the text go on to name
   * one of the layer's own directories? That is the one test that
   * distinguishes `<name>/uploads/x.pdf` — a reference to the layer — from
   * `<name>/docs/guides/x.md`, which is a path in the repository. The root
   * layer's own name is written `<name>` here rather than spelled out, for
   * the reason the module docblock gives about this file's own text: an
   * example that spells it out is itself a wrong-direction reference, and a
   * gate whose documentation breaches it is the shape this repository already
   * carves `declared-path-literal` for. Resolving them to absolute paths
   * would answer a different
   * question (does this file exist), and for the root layer every relative
   * path in the tree resolves inside its root, so that question answers yes
   * for everything.
   */
  declaredPaths: string[];
}

/** True when EVERY kind the directory declares is machine-written — conservative, so a directory that also holds authored content keeps being read. */
function declaresMachineWritten(kinds: readonly string[] | undefined): boolean {
  if (kinds === undefined || kinds.length === 0) return false;
  return kinds.every((k) => isStateGraph(k) || isDerivedGraph(k));
}

/** The machine-written directories each sub-graph of `root` declares from within, in `<dir>/graph.json`. */
export function subgraphMachineWritten(root: string, dirs: readonly { path?: string; scope?: "instance" | "repository" }[]): string[] {
  const out: string[] = [];
  for (const d of dirs) {
    if (d.path === undefined || d.path === "") continue;
    const dir = join(rootForScope(root, d.scope), d.path);
    const graph = join(dir, "graph.json");
    if (!existsSync(graph)) continue;
    let inner: { directories?: { path?: string; graphTypologies?: string[] }[] };
    try {
      inner = JSON.parse(readFileSync(graph, "utf-8")) as typeof inner;
    } catch {
      continue;
    }
    for (const e of inner.directories ?? []) {
      if (e.path !== undefined && e.path !== "" && declaresMachineWritten(e.graphTypologies)) out.push(join(dir, e.path));
    }
  }
  return out;
}

function instances(repoRoot: string): Instance[] {
  return layerRootsIn(repoRoot).map((root) => {
    const decl = JSON.parse(readFileSync(join(root, findDeclarationFile(root)!), "utf-8")) as {
      name?: string;
      needs?: string[];
      directories?: { path?: string; graphTypologies?: string[]; scope?: "instance" | "repository" }[];
      builtAtPublish?: { path?: string }[];
    };
    // `rootForScope`, NEVER `join(root, path)`. A directory entry may carry
    // `scope: "repository"`, and it then resolves against the REPO ROOT
    // rather than against the declaring layer — 23 of the 45 entries in
    // `cat-harness.json` do, more than half, including `beans/`, `todos/`,
    // `issue-marks/` and six `*/library/` trees.
    //
    // Composing `join(root, path)` for those yields `cat-harness/beans/`,
    // which does not exist, so the directory was not excluded and every file
    // in it was read as authored prose. Measured cost below.
    const machineWritten = (decl.directories ?? [])
      .filter((d) => d.path !== undefined && declaresMachineWritten(d.graphTypologies))
      .map((d) => join(rootForScope(root, d.scope), d.path!))
      // A named sub-graph declares its graphs FROM WITHIN, in its own
      // `graph.json` (#980): cat-harness's corpus is `library/graph.json`'s
      // `corpus/`, no longer a top-level entry of `cat-harness.json`, and it
      // is just as machine-written as when it was one.
      .concat(subgraphMachineWritten(root, decl.directories ?? []))
      // A `builtAtPublish` path is machine-written by declaration too: each
      // entry names the `writer` that builds it at publish, and nothing there
      // is committed or authored. The checkout-built ones project OTHER
      // layers by design — `docs/assets/library/` holds byte copies of
      // sub-graphs declared inside another layer's entry (bean `8pzh`) — so
      // a name they carry is the projected layer's, not this one reaching up
      // (folio-assistant#2611: 27 findings once the pages were restored).
      .concat(
        (decl.builtAtPublish ?? [])
          .filter((b) => typeof b.path === "string" && b.path !== "")
          .map((b) => join(root, b.path!)),
      );
    // A declaration with no `name` cannot be a reference TARGET (nothing to
    // match) and cannot own files by name either, so it is skipped rather
    // than given a fallback that would invent a layer.
    const declaredPaths = (decl.directories ?? [])
      .map((d) => d.path)
      .filter((d): d is string => d !== undefined && d !== "");
    return { root, name: decl.name ?? "", needs: decl.needs, machineWritten, declaredPaths };
  });
}

/**
 * The layer a file belongs to: the INNERMOST declaring root containing it.
 *
 * The root layer's directory contains every other one, so "which instance
 * is this file in" has 17 true answers by containment and exactly one useful
 * one. Longest matching root wins.
 */
function ownerOf(abs: string, all: readonly Instance[]): string | undefined {
  let best: Instance | undefined;
  for (const i of all) {
    if (i.name === "") continue;
    if ((abs === i.root || abs.startsWith(i.root + sep)) && (best === undefined || i.root.length > best.root.length)) {
      best = i;
    }
  }
  return best?.name;
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...filesUnder(p));
    else if (EXTENSIONS.has(e.name.slice(e.name.lastIndexOf(".")))) out.push(p);
  }
  return out;
}

// ── The scan ────────────────────────────────────────────────────

export interface ReferenceReport {
  instances: number;
  /** Every occurrence, with the verdict that was reached and its basis. */
  classified: { occurrence: Occurrence; verdict: ReferenceVerdict }[];
  /** Files in a directory DECLARED to hold a machine-written graph. Counted, so the exclusion is visible rather than silent. */
  skippedMachineWritten: number;
  /** Files that declare THEMSELVES generator output — by `$schema`, by a top-level `_generated`, or by `generated:` front matter. Counted separately from the directory rule: a different declaration, at a different granularity. */
  skippedGeneratorWritten: number;
  /** Layers whose `needs` nobody has declared. Reported, never assumed. */
  undeclared: string[];
}

/**
 * The routes a harness's visualisers build on ANOTHER layer's site
 * (`builtOnHostSite`), as absolute directories: `derive:publish`'s own
 * derivation ({@link hostSiteArtefacts}), so this check and the publish plan
 * agree on what is built where. They sit inside the host's root, e.g.
 * `cat-harness/docs/en/folio-assistant-core/bibliography/`, but the host
 * declares none of them: they are another harness's built-at-publish output,
 * machine-written exactly as a declared `builtAtPublish` path is.
 */
export function hostSiteDirs(root: string): string[] {
  return hostSiteArtefacts(root).map((a) => a.abs.replace(/[\\/]+$/, ""));
}

export function analyse(root = REPO_ROOT, hostSite: readonly string[] = hostSiteDirs(root)): ReferenceReport {
  const all = instances(root).filter((i) => i.name !== "");
  const byName = new Map(all.map((i) => [i.name, i]));
  const needs = new Map(all.map((i) => [i.name, i.needs]));

  const flat = flattenDependencies(
    all.map((i) => ({ id: i.name, needs: (i.needs ?? []).filter((n) => byName.has(n)), fatal: false })),
  );
  if (flat.problems.length > 0) {
    // Refused rather than walked, the same as `kg-detangle`: no ancestor set
    // exists for a broken graph, and a partial one reports allowed
    // references as wrong-direction.
    throw new Error(
      `check:reference-direction: the instance needs graph is broken — ${flat.problems.map((p) => p.detail).join("; ")}`,
    );
  }
  const anc = ancestorsOf(flat.order);
  const rule: LayerRule = { allowed: allowedFromNeeds(needs, anc) };

  /** Who sits ABOVE `name`: every layer with `name` among its ancestors. */
  const above = new Map<string, string[]>(
    all.map((i) => [i.name, all.filter((u) => anc.get(u.name)?.has(i.name)).map((u) => u.name)]),
  );
  /**
   * What THIS occurrence of a name that collides with the repository's name
   * actually names.
   *
   * `undefined` for the ordinary case — the target's name is not the
   * repository's, so nothing here applies and the arrow decides. Only a
   * layer rooted AT the repository root collides, because only then is the
   * layer's name the repository's name.
   *
   * The three answers, in the order they are tested, and the order is the
   * substance:
   *
   *  1. **`"instance"`** — the text carries `<name>/<declared directory>`, so
   *     it points into a directory this layer actually DECLARES. Tested
   *     FIRST, so `https://…/<name>/uploads/x.pdf` is the layer rather than
   *     an address: a URL into a layer's own directory is still a
   *     reference to that layer, and putting the URL test first would have
   *     excused it. (`<name>` rather than the root's actual name, for the
   *     reason {@link Instance}'s `declaredPaths` gives: the spelled-out
   *     example would be a wrong-direction reference in this very file.)
   *  2. **`"repository"`** — the name sits inside an `http(s)` URL (an
   *     ADDRESS), or appears as `<owner>/<name>` (a repository slug), or as
   *     `<name>/` followed by any other path segment (a path in the
   *     repository, not in the layer).
   *  3. **`"unknown"`** — a bare prose mention: no path, no URL, nothing to
   *     tell the repository from the layer. Still `undetermined`, and that
   *     is the honest residue rather than a case to be eliminated.
   *
   * It reads the DECLARATION rather than a path literal, which is this
   * repository's standing rule for the generated-file question two functions
   * up and holds for the same reason: `uploads/` and `tools/` are what the
   * root declares TODAY, and a fourth directory added tomorrow is recognised
   * without an edit here.
   */
  const collisionOf = (occ: Occurrence): NameCollision | undefined => {
    const target = byName.get(occ.to);
    if (target === undefined || target.root !== root) return undefined;
    const { text } = occ;
    const name = occ.to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Bounded at BOTH ends, for the reason `occurrencesOf` is: an unbounded
    // `<name>/tools` also matches `<name>/toolsmiths`, and an unbounded left
    // edge matches a longer layer name ending in the target's.
    for (const declared of target.declaredPaths) {
      const seg = declared.replace(/^\.?\/+/, "").replace(/\/+$/, "");
      if (seg === "") continue;
      const esc = seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?<![A-Za-z0-9_-])${name}/${esc}(?![A-Za-z0-9_-])`).test(text)) return "instance";
    }
    const inUrl = (text.match(/https?:\/\/\S+/g) ?? []).some((u) =>
      new RegExp(`(?<![A-Za-z0-9_-])${name}(?![A-Za-z0-9_-])`).test(u),
    );
    if (inUrl) return "repository";
    if (new RegExp(`[A-Za-z0-9_.-]+/${name}(?![A-Za-z0-9_-])`).test(text)) return "repository";
    if (new RegExp(`(?<![A-Za-z0-9_-])${name}/[A-Za-z0-9_.@-]`).test(text)) return "repository";
    return "unknown";
  };

  // Every declared machine-written directory, across every layer. Flat
  // rather than per-instance because a layer may declare a directory
  // inside another's root (`cat-harness.json` declares
  // `folio-assistant-core/schemas/`), and the file is machine-written either
  // way — the declaration is about the DIRECTORY, not about who scans it.
  // A host-site route (`builtOnHostSite`) is built at publish too, by the
  // harness that declares the visualiser, inside the HOST's root; the host
  // declares none of it. Judged by the directory it sits in, a core page built
  // into cat-harness's site read as cat-harness naming whatever core's library
  // projects (folio-assistant#2985: six bibliography files naming smart-trust).
  const machineWritten = [...all.flatMap((i) => i.machineWritten), ...hostSite];
  const isMachineWritten = (abs: string): boolean =>
    machineWritten.some((d) => abs === d || abs.startsWith(d.endsWith(sep) ? d : d + sep));

  const classified: ReferenceReport["classified"] = [];
  let skippedMachineWritten = 0;
  let skippedGeneratorWritten = 0;
  for (const abs of filesUnder(root)) {
    if (isMachineWritten(abs)) {
      skippedMachineWritten++;
      continue;
    }
    if (isGeneratorWritten(abs) || declaresGenerated(abs)) {
      skippedGeneratorWritten++;
      continue;
    }
    const from = ownerOf(abs, all);
    if (from === undefined) continue;
    const targets = above.get(from) ?? [];
    if (targets.length === 0) continue;
    let text: string;
    try {
      text = readFileSync(abs, "utf-8");
    } catch {
      continue; // unreadable is not clean, but it is also not a finding about direction
    }
    const file = relative(root, abs).split(sep).join("/");
    // X1 is a property of the FILE, read once, and appended LAST so any other
    // exemption that also matches keeps its own reason.
    // X5's index rows are likewise decided by what the FILE declares.
    const exemptions = [
      ...EXEMPTIONS,
      ...(declaresSubgraphIndex(abs) ? [DATED_PROPOSAL_INDEX_ROW] : []),
      ...(declaresTranslationMirror(abs) ? [TRANSLATION_MIRROR] : []),
    ];
    for (const to of targets) {
      for (const hit of occurrencesOf(text, to)) {
        const occurrence: Occurrence = { file, line: hit.line, text: hit.text.trim(), from, to };
        classified.push({ occurrence, verdict: classifyReference(occurrence, rule, collisionOf, exemptions) });
      }
    }
  }
  return {
    instances: all.length,
    classified,
    skippedMachineWritten,
    skippedGeneratorWritten,
    undeclared: all.filter((i) => i.needs === undefined).map((i) => i.name).sort(),
  };
}

// ── The committed sidecar ───────────────────────────────────────

/** The sidecar's stem: `<instance>/test/results/<stem>.qa-results.json`. */
export const SIDECAR_STEM = "reference-direction";

/**
 * The one family {@link comparableDirection} holds OUT of the staleness key.
 *
 * Named rather than spelled at each use, because the whole freshness decision
 * turns on which family this is — a second spelling one edit out of step would
 * silently start grading the counts, or silently stop grading a state.
 */
export const CENSUS_FAMILY = "verdict-census";

/** A `PENDING` row: a file with no single destination, and how many it names. */
export interface PendingEntry {
  file: string;
  names: number;
}

/**
 * The DETERMINATIONS this axis has reached — everything `--check` grades.
 *
 * Every field here moves when a RULING moves, never when somebody writes a
 * paragraph: a file acquires or loses a second destination, an entry stops
 * qualifying, a layer starts or stops declaring `needs`. That is the
 * property that makes grading them worth doing, and it is the property the
 * verdict counts do not have.
 */
export interface DirectionStates {
  /** The `PENDING` list as the source declares it. Membership is the ruling. */
  pendingHeld: PendingEntry[];
  /** Entries that no longer qualify — the half that makes `PENDING` honest. */
  pendingStale: { file: string; why: string }[];
  /** Files naming several layers above them that nobody has listed. This is what exits 1. */
  multiDestinationUnlisted: { file: string; names: number }[];
  /** Layers that declare no `needs`, so nothing about their layer is known. */
  undeclaredInstances: string[];
  /**
   * A.10 (owner, Q-B 2026-10-01): EVERY file holding a wrong-direction
   * reference, single- and multi-destination alike — one entry per file and
   * per layer above it that the file names.
   *
   * Per (file, target) rather than per file, so that a file already in the
   * baseline which starts naming a FURTHER layer above it is a new entry
   * too; a count per file could not see a file trading one target for
   * another. Graded under `--check` as NEW-against-the-baseline only: the
   * backlog is inherited, a new pair fails, a fixed pair is resolved.
   */
  wrongDirection: { file: string; target: string }[];
}

/**
 * Reduce a scan to the four determinations, with no filesystem and no printing.
 *
 * Pure and exported so a test can exercise it on a three-file synthetic tree.
 * The real corpus is deliberately out of reach of this suite: a prior session's
 * tests walked it and pushed a sibling past its 5 s budget.
 */
export function directionStates(
  report: ReferenceReport,
  pending: readonly PendingEntry[],
): DirectionStates {
  const wrong = report.classified.filter((c) => c.verdict.verdict === "wrong-direction");
  const byFile = new Map<string, Set<string>>();
  for (const c of wrong) {
    byFile.set(c.occurrence.file, new Set([...(byFile.get(c.occurrence.file) ?? []), c.occurrence.to]));
  }
  const listed = new Set(pending.map((p) => p.file));
  const pendingStale = [
    ...pending
      .filter((p) => !byFile.has(p.file))
      .map((p) => ({ file: p.file, why: "no wrong-direction reference left" })),
    ...pending
      .filter((p) => (byFile.get(p.file)?.size ?? 0) === 1)
      .map((p) => ({ file: p.file, why: "now names ONE instance, so it has a destination and is not pending" })),
  ].sort((a, b) => a.file.localeCompare(b.file));
  const multiDestinationUnlisted = [...byFile]
    .filter(([f, to]) => to.size > 1 && !listed.has(f))
    .map(([file, to]) => ({ file, names: to.size }))
    .sort((a, b) => a.file.localeCompare(b.file));
  return {
    pendingHeld: [...pending].sort((a, b) => a.file.localeCompare(b.file)),
    pendingStale,
    multiDestinationUnlisted,
    undeclaredInstances: [...report.undeclared].sort(),
    wrongDirection: [...byFile]
      .flatMap(([file, to]) => [...to].map((target) => ({ file, target })))
      .sort((a, b) => a.file.localeCompare(b.file) || a.target.localeCompare(b.target)),
  };
}

/**
 * The verdict counts — this axis's ANSWER, recorded but never graded.
 *
 * Only verdicts. `skippedMachineWritten` and `skippedGeneratorWritten` are
 * counts of FILES and stay in the printed report, for the reason the module
 * docblock gives: a file census says nothing about direction and moves on any
 * commit that adds a page.
 *
 * `pendingOccurrences` is a count of OCCURRENCES held by the `PENDING` list,
 * which is a verdict count about a ruling rather than a census of the tree, so
 * it belongs with these. Its membership — the part that is a decision — is in
 * {@link DirectionStates} and IS graded.
 */
export function directionCensus(
  report: ReferenceReport,
  states: DirectionStates,
): Record<string, number> {
  const n = (v: ReferenceVerdict["verdict"]) => report.classified.filter((c) => c.verdict.verdict === v).length;
  const wrong = report.classified.filter((c) => c.verdict.verdict === "wrong-direction");
  const held = new Set(states.pendingHeld.map((p) => p.file));
  return {
    instances: report.instances,
    occurrences: report.classified.length,
    allowed: n("allowed"),
    wrongDirection: wrong.length,
    wrongDirectionFiles: new Set(wrong.map((c) => c.occurrence.file)).size,
    exempt: n("exempt"),
    namesRepository: n("names-repository"),
    undetermined: n("undetermined"),
    pendingFiles: states.pendingHeld.length,
    pendingOccurrences: wrong.filter((c) => held.has(c.occurrence.file)).length,
  };
}

/**
 * Assemble the sidecar. Pure — takes a scan, returns the document.
 *
 * `exemptionsDeclared` is the number of exemptions, each of which carries a
 * stated reason in the source. It is recorded with the states rather than with
 * the counts because an exemption appearing or disappearing is an edit
 * somebody made, not a corpus that moved.
 */
export function buildDirectionResult(args: {
  report: ReferenceReport;
  pending: readonly PendingEntry[];
  exemptionsDeclared: number;
  script?: string;
  scriptAbsPath?: string;
  now?: Date;
}): QaResult {
  const states = directionStates(args.report, args.pending);
  const census = directionCensus(args.report, states);
  const script = args.script ?? join("cat-harness-tools", "scripts", "check-reference-direction.ts");
  return buildQaResult({
    script,
    scriptAbsPath: args.scriptAbsPath ?? join(import.meta.dir, "check-reference-direction.ts"),
    subject: { kind: "reference-direction", id: "instances" },
    families: {
      "multi-destination-unlisted": {
        summary:
          "A file holding a wrong-direction reference to MORE THAN ONE instance above it, which " +
          "`PENDING` does not list. `names > 1` is the whole membership rule, so an unlisted one " +
          "is an unrecorded question rather than a finding somebody can act on: \"move it up\" has " +
          "no single destination. This is the set the script exits 1 on, and recording it is not " +
          "resolving it — whether these join `PENDING` or are ruled on is issue #1219's question.",
        entries: states.multiDestinationUnlisted,
      },
      "pending-stale": {
        summary:
          "A `PENDING` entry that no longer qualifies — either no wrong-direction reference is left " +
          "in the file, or it now names exactly one instance and so HAS a destination. The set is " +
          "compared both ways on purpose: a list that only grows stops meaning anything.",
        entries: states.pendingStale,
      },
      "pending-held": {
        summary:
          "The files held pending a ruling, as the source declares them. Not findings: the RULING, " +
          "committed, so a reader with only this file can tell a question nobody has answered from " +
          "an axis nobody has run. Membership moves only when somebody edits the list, which is why " +
          "it is graded while the occurrence count it holds is not.",
        entries: states.pendingHeld,
      },
      "wrong-direction": {
        summary:
          "A.10 (owner, Q-B 2026-10-01): every file holding a wrong-direction reference — naming ONE " +
          "instance above it or several — one entry per file and per instance it names. The backlog, " +
          "recorded so that `--check` can tell an inherited pair from a NEW one: a file newly naming " +
          "an instance above it, single destination or not, fails; one that stops is resolved. The " +
          "fix is to REWORD in place (Q1), not to move the file.",
        entries: states.wrongDirection,
      },
      "instances-undeclared": {
        summary:
          "An instance that declares no `needs`, so nothing about its layer is known and every " +
          "reference from it is `undetermined`. `[]` is the floor; absent is nobody-has-said, and " +
          "collapsing the two would make an undeclared instance look either tangled or spotless.",
        entries: states.undeclaredInstances.map((name) => ({ instance: name })),
      },
      [CENSUS_FAMILY]: {
        summary:
          "Not findings, and NOT graded: what the axis says on the run that wrote this. Verdict " +
          "counts are recorded because they ARE this axis's answer — a reader holding only this " +
          "file cannot otherwise tell `audited clean` from `never audited`, which is the whole " +
          "reason the sidecar exists. They are not graded because they move whenever anybody " +
          "writes a paragraph, and `audit-coverage` already established that a gate keyed on a " +
          "number like that is stale by default. FILE counts are not here at all — how many files " +
          "were skipped as machine-written or self-declared generator output is a census of the " +
          "tree, not a statement about direction, and stays in the printed report. " +
          `${states.pendingHeld.length} file(s) held pending; ${args.exemptionsDeclared} exemption(s) declared, each with a stated reason.`,
        entries: [census],
      },
    },
  });
}

/**
 * The staleness key — everything except the timestamp and the counts.
 *
 * `total` goes too, because it SUMS a family that is not graded: leaving it in
 * would grade the census through the back door, which is the same mistake in a
 * place nobody would look for it.
 *
 * `producer.script_hash` stays IN. A result is allowed to be old; it is not
 * allowed to have been written by a producer that no longer exists, because
 * then what it says is the old code's answer — `check:harness-state`'s rule
 * for `health`, and the reason it is a hash rather than an age.
 */
export function comparableDirection(r: QaResult): string {
  const { total: _total, families, ...rest } = r;
  const graded = Object.fromEntries(Object.entries(families).filter(([k]) => k !== CENSUS_FAMILY));
  return JSON.stringify({ ...rest, families: graded });
}

/**
 * Is the committed sidecar's RULING what this run computed?
 *
 * `absent` is its own answer and never folded into `current`. A missing
 * sidecar reported as not-stale is the `dh4f` defect precisely — no record at
 * all reading identically to a clean one.
 *
 * It reads and returns. It does not write, does not create the directory, and
 * does not repair what it is reporting: bean `ymsu` has two witnesses already
 * and this is not going to be the third.
 */
export function directionSidecarState(
  instanceRoot: string,
  fresh: QaResult,
): "absent" | "stale" | "current" {
  const p = overlayPath(qaResultPath(instanceRoot, SIDECAR_STEM));
  if (!existsSync(p)) return "absent";
  try {
    return comparableDirection(JSON.parse(readFileSync(p, "utf-8")) as QaResult) === comparableDirection(fresh)
      ? "current"
      : "stale";
  } catch {
    return "stale";
  }
}

// ── Moved files keep their baseline pairs ───────────────────────

/**
 * Ruling (i) (owner, 2026-10-11T05:58:12Z, session_01UC1NuEuSy1MBNpEhnDuiGj:
 * "2 y" — *"re-key the baseline for the 233 moved pairs (mechanical rename,
 * no growth in substance)"*): a wrong-direction pair is keyed by its FILE, so
 * a file that moved and still says what it said reads as one pair resolved
 * and one pair NEW. The reference did not change; only the path did.
 *
 * The baseline is `qa-reports`, written by `main`, so it re-keys itself the
 * first time `main` runs after the move lands — but the change that MAKES the
 * move is judged against the baseline from before it, and every inherited pair
 * on a moved file fails it. So the comparison maps a baseline pair to the
 * file's new path, and only on EVIDENCE of a move, never on a list:
 *
 *  1. **Between layers** — the rule `rewrite-moved-paths.ts` applies (bean
 *     `70lx`): the baseline's file `<A>/<rest>` is gone, and `<B>/<rest>`
 *     exists under exactly one other layer root.
 *  2. **A visualiser page** — the page's address is DECLARED
 *     (`visualisers` in the harness's `<instance>.json`, route by
 *     `schemas/kg/visualiser-route.ts`): a page now at its localised route was,
 *     before bean `t4xb`, at its forwarding address `<harness>/<visualiser>/`
 *     or its alias `<alias>/`, the two addresses `compose-docs.ts` still
 *     forwards. The baseline's file at one of those is gone and the same page
 *     exists at the localised route.
 *
 * In both, the old path must NOT exist (a file re-created at its old home is a
 * different file) and the new one must, and there must be exactly ONE
 * candidate — an ambiguous move is not re-keyed, so it reads as resolved plus
 * new, the conservative direction for a gate. The target is never touched: a
 * moved file that now names a FURTHER layer above it is still new.
 */
export interface MoveEvidence {
  /** Does this repo-relative path exist in the checkout? */
  exists: (path: string) => boolean;
  /** Every layer root, repo-relative (`cat-harness`, `smart-base/…`). */
  instanceRoots: readonly string[];
  /** Declared page moves: a page under `now` was at the same path under each of `before`. Repo-relative prefixes ending in `/`. */
  pageMoves: readonly { now: string; before: readonly string[] }[];
}

/** Where a baseline file moved to, when the evidence shows exactly one place; else `undefined`. */
export function movedTo(file: string, ev: MoveEvidence): string | undefined {
  if (ev.exists(file)) return undefined;
  const candidates = new Set<string>();
  const owner = [...ev.instanceRoots]
    .filter((r) => file.startsWith(`${r}/`))
    .sort((a, b) => b.length - a.length)[0];
  if (owner !== undefined) {
    const rest = file.slice(owner.length + 1);
    for (const r of ev.instanceRoots) {
      if (r === owner || r.startsWith(`${owner}/`) || owner.startsWith(`${r}/`)) continue;
      if (ev.exists(`${r}/${rest}`)) candidates.add(`${r}/${rest}`);
    }
  }
  for (const m of ev.pageMoves) {
    for (const b of m.before) {
      if (file.startsWith(b) && ev.exists(m.now + file.slice(b.length))) candidates.add(m.now + file.slice(b.length));
    }
  }
  return candidates.size === 1 ? [...candidates][0] : undefined;
}

/**
 * The family re-keyed: `wrong-direction`, whose `file` is where the reference
 * IS. Not `pending-stale`, whose `file` is what the `PENDING` list SAYS — a
 * moved file's entry there is fixed by editing the list, which is a diff a
 * reviewer reads, and re-keying it would hide the stale literal.
 */
const REKEYED_FAMILIES = ["wrong-direction"] as const;

/** {@link movedTo} over a baseline: each moved entry takes its file's new path, and nothing is added or dropped. */
export function rekeyMovedPairs(baseline: QaResult, ev: MoveEvidence): { result: QaResult; rekeyed: number } {
  let rekeyed = 0;
  const families = { ...baseline.families };
  for (const f of REKEYED_FAMILIES) {
    const fam = families[f];
    if (fam === undefined) continue;
    const entries = (fam.entries as { file?: unknown }[]).map((e) => {
      if (typeof e.file !== "string") return e;
      const to = movedTo(e.file, ev);
      if (to === undefined) return e;
      rekeyed++;
      return { ...e, file: to };
    });
    families[f] = { ...fam, entries };
  }
  return { result: { ...baseline, families }, rekeyed };
}

/**
 * A Tool split into its folder (bean `tdir`, folder = file = id): a Tool once
 * declared in `<D>/tools/index.ts`, or alone in `<D>/tools/<id>.ts`, now lives
 * in `<D>/tools/<id>/<id>.ts`. `tools/index.ts` survives the split, so
 * {@link movedTo}'s "old path is gone" cannot see it; the evidence is in the
 * FRESH run instead. A baseline pair `(old, T)` that the fresh run no longer
 * holds is re-keyed to the one fresh pair `(<D>/tools/<id>/<id>.ts, T)` that
 * could be it — from `index.ts` any id, from `<id>.ts` only that id. Two
 * candidates are ambiguous and are not re-keyed, as in {@link movedTo}.
 */
export function rekeyToolSplits(baseline: QaResult, fresh: QaResult): { result: QaResult; rekeyed: number } {
  let rekeyed = 0;
  const families = { ...baseline.families };
  for (const f of REKEYED_FAMILIES) {
    const fam = families[f];
    if (fam === undefined) continue;
    const now = ((fresh.families[f]?.entries ?? []) as { file?: unknown; target?: unknown }[]).filter(
      (e): e is { file: string; target: string } => typeof e.file === "string" && typeof e.target === "string",
    );
    const held = new Set(now.map((e) => `${e.file}\0${e.target}`));
    const taken = new Set<string>();
    const entries = (fam.entries as { file?: unknown; target?: unknown }[]).map((e) => {
      if (typeof e.file !== "string" || typeof e.target !== "string" || held.has(`${e.file}\0${e.target}`)) return e;
      const m = /^(.*\/)?tools\/([^/]+)\.ts$/.exec(e.file);
      if (m === null) return e;
      const dir = `${m[1] ?? ""}tools/`;
      const stem = m[2];
      const candidates = now.filter((c) => {
        if (c.target !== e.target || !c.file.startsWith(dir) || taken.has(`${c.file}\0${c.target}`)) return false;
        const f2 = /^([^/]+)\/([^/]+)\.ts$/.exec(c.file.slice(dir.length));
        return f2 !== null && f2[1] === f2[2] && (stem === "index" || f2[1] === stem);
      });
      if (candidates.length !== 1) return e;
      taken.add(`${candidates[0].file}\0${candidates[0].target}`);
      rekeyed++;
      return { ...e, file: candidates[0].file };
    });
    families[f] = { ...fam, entries };
  }
  return { result: { ...baseline, families }, rekeyed };
}

/** The evidence {@link movedTo} reads, from the checkout at `root`. */
export function moveEvidence(root = REPO_ROOT): MoveEvidence {
  const rel = (abs: string) => relative(root, abs).split(sep).join("/");
  const site = rel(siteOwnerDir(root));
  const pageMoves = declaredVisualisers(root).map((v) => {
    const parts = { harness: v.harness, visualiser: v.id };
    const before = [`${site}/${visualiserRoute(forwardingParts(parts))}`];
    if (v.alias !== undefined) before.push(`${site}/${aliasRoute(v.alias)}`);
    return { now: `${site}/${visualiserRoute(pageParts(parts))}`, before };
  });
  return {
    exists: (p) => existsSync(join(root, p)),
    instanceRoots: layerRootsIn(root).map(rel).filter((r) => r !== ""),
    pageMoves,
  };
}

// ── Reporting ───────────────────────────────────────────────────

const GATE = "check:reference-direction";

/**
 * The families `--check` fails on when an entry is NEW against the baseline.
 * Exported so the tests judge with the gate's own list, not a copy of it.
 */
// `multi-destination-unlisted` is RECORDED and no longer in this list:
// A.10's `wrong-direction` subsumes it. A file newly naming several
// layers above it newly holds at least one (file, instance) pair, and
// that pair is what fails, whatever PENDING says — the ruling (Q1:
// reword in place) retired "list it pending" as the answer to a new one.
// Grading both would fail one defect twice, and would fail a PR on files
// a STALE baseline never recorded: measured on this change, `main`'s
// entry predated seven multi-destination files already on `main`.
export const CHECK_FAIL_ON_NEW = ["wrong-direction", "pending-stale", "instances-undeclared"] as const;

/**
 * How many exempt occurrences each exemption excused, keyed by its reason and
 * in declaration order (X1, appended per file, last). Exported so a test can
 * hold that every exemption is counted under its own line.
 */
export function exemptionCounts(exempt: readonly { verdict: ReferenceVerdict }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of [...EXEMPTIONS, DATED_PROPOSAL_INDEX_ROW, TRANSLATION_MIRROR]) counts.set(e.reason, 0);
  for (const c of exempt) {
    if (c.verdict.verdict !== "exempt") continue;
    const { reason } = c.verdict.exemption;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return counts;
}

/**
 * The part of a report a caller is judged on: occurrences in files it owns,
 * and its own layers among those declaring no `needs` (owner ruling
 * 2026-11-05, "Move the checks"). `ownInstances` undefined keeps every
 * layer.
 */
export function scopeReport(
  report: ReferenceReport,
  owns: (file: string) => boolean,
  ownInstances: ReadonlySet<string> | undefined,
): ReferenceReport {
  return {
    ...report,
    classified: report.classified.filter((c) => owns(c.occurrence.file)),
    undeclared: ownInstances ? report.undeclared.filter((n) => ownInstances.has(n)) : report.undeclared,
  };
}

function main(): number {
  const args = process.argv.slice(2);
  // `--check` reads and compares; it never writes. Bean `ymsu` — a gate that
  // repairs the tree the rest of the run is judging makes a later gate's
  // verdict meaningless, and this repository has two of those already.
  const check = args.includes("--check");
  if (check) {
    const usage = judgeUsage(GATE, args, ["--against", "--findings", "--undetermined", "--strict"]);
    if (usage !== undefined) return usage;
  }
  const { against, exit: badRef } = againstOrUsage(GATE, args);
  if (badRef !== undefined) return badRef;
  // In a layer's PR checks, only the caller's own files and layers are
  // judged (owner ruling 2026-11-05, "Move the checks"; `lib/gate-own.ts`):
  // a lower layer's file naming a layer above it is that layer's to fix,
  // in its own CI. A scoped run writes no working copy, which covers the
  // whole corpus and is the owning repository's.
  const scoped = gateOwnsFile(".") !== undefined;
  const report = scoped ? scopeReport(analyse(), (f) => gateOwnsFile(f) !== false, gateOwnInstances()) : analyse();
  const pending = scoped ? PENDING.filter((p) => gateOwnsFile(p.file) !== false) : PENDING;

  if (report.instances === 0) {
    console.error("check:reference-direction: found 0 declared instances — wrong root, or the tree moved.");
    return 2;
  }

  const of = (v: ReferenceVerdict["verdict"]) => report.classified.filter((c) => c.verdict.verdict === v);
  const wrong = of("wrong-direction");
  const undet = of("undetermined");
  const exempt = of("exempt");
  const namesRepo = of("names-repository");
  const states = directionStates(report, pending);

  console.log(`Reference direction — ${report.instances} instances, ${report.classified.length} name occurrences pointing up the dependency arrow\n`);
  console.log(`  wrong-direction   ${String(wrong.length).padStart(5)}   in ${new Set(wrong.map((c) => c.occurrence.file)).size} files`);
  console.log(`  exempt            ${String(exempt.length).padStart(5)}   ${EXEMPTIONS_DECLARED} exemptions, each with a stated reason`);
  // Per exemption, so a carve doing more work than anyone intended shows
  // which one it is. PRINTED, not recorded: like the total, it moves with the
  // corpus rather than with a ruling.
  for (const [reason, count] of exemptionCounts(exempt)) {
    console.log(`    ${String(count).padStart(5)}  ${reason.length > 96 ? `${reason.slice(0, 95)}…` : reason}`);
  }
  // Its OWN line, never folded into `allowed` and never into the two skipped
  // counts below. It is a different statement from all three: the occurrence
  // was read, it was judged, and what it names owes no direction.
  console.log(`  names-repository  ${String(namesRepo.length).padStart(5)}   names the repository or its address, which is not a layer`);
  console.log(`  undetermined      ${String(undet.length).padStart(5)}   declined to judge — NOT clean`);
  // PRINTED, never recorded. Both are counts of FILES — they move when
  // somebody adds a generated page and say nothing about direction. See the
  // module docblock for where the line is drawn and why.
  console.log(`\n  Not read, both answered from a declaration rather than a path:`);
  console.log(`    ${report.skippedMachineWritten} file(s) — their DIRECTORY declares a graph a process writes (holds state/derived)`);
  console.log(`    ${report.skippedGeneratorWritten} file(s) — the FILE declares itself generator output (\`$schema\` declared generated, \`_generated\`, or \`generated:\` front matter)`);

  if (wrong.length > 0) {
    const byPair = new Map<string, number>();
    for (const c of wrong) {
      const k = `${c.occurrence.from} → ${c.occurrence.to}`;
      byPair.set(k, (byPair.get(k) ?? 0) + 1);
    }
    console.log("\nWrong-direction, by pair:");
    for (const [k, v] of [...byPair].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`);
  }

  if (args.includes("--findings")) {
    console.log("\nEvery wrong-direction occurrence:");
    for (const c of wrong) console.log(`  ${c.occurrence.file}:${c.occurrence.line}  [→ ${c.occurrence.to}]  ${c.occurrence.text.slice(0, 100)}`);
  }

  // The three-state discipline, stated in the output rather than left to a
  // reader's charity — `zlmp`'s tool says the same sentence about its own
  // unjudged edges, and that sentence is the reason its 43 → 49 is legible.
  // Still printed, and still in these words, for as long as ANY occurrence is
  // undetermined. Narrowing the repository-name case from a blanket to the
  // occurrences that really are ambiguous shrank this bucket; it did not
  // retire it, and a reader who stops seeing the sentence would reasonably
  // conclude that it had.
  if (undet.length > 0) {
    console.log("\nUndetermined is not a pass. Two things land there:");
    if (report.undeclared.length > 0) {
      console.log(`  · ${report.undeclared.length} instance(s) declare no \`needs\`, so nothing about their layer is known: ${report.undeclared.join(", ")}`);
    }
    const rootNamed = new Set(undet.map((c) => c.occurrence.to));
    if (rootNamed.size > 0) {
      console.log(`  · the target's name is also the repository's name (${[...rootNamed].join(", ")}) and the occurrence is a bare mention — no path and no URL — so a name match cannot tell the instance from the repository`);
    }
    if (args.includes("--undetermined")) {
      for (const c of undet.slice(0, 200)) console.log(`    ${c.occurrence.file}:${c.occurrence.line}  ${c.verdict.basis}`);
    }
  }

  // PENDING is checked BOTH ways, which is the half that makes it honest.
  const heldFiles = new Set(states.pendingHeld.map((p) => p.file));
  const held = wrong.filter((c) => heldFiles.has(c.occurrence.file));
  console.log(
    `\n  of the wrong-direction count, ${held.length} occurrence(s) in ${pending.length} file(s) are PENDING —` +
      ` each names more than one instance above it, so there is no single place to move it to (issue #1219)`,
  );

  if (states.pendingStale.length > 0) {
    console.error(`\n✗ ${states.pendingStale.length} PENDING entr(y/ies) no longer qualify — delete them:`);
    for (const p of states.pendingStale) console.error(`    ${p.file} — ${p.why}`);
  }
  if (states.multiDestinationUnlisted.length > 0) {
    console.error(`\n✗ ${states.multiDestinationUnlisted.length} file(s) name several instances above them and are not in PENDING:`);
    for (const p of states.multiDestinationUnlisted) console.error(`    ${p.file} — names ${p.names}`);
  }

  // The sidecar is built from what was just measured, and written — or, under
  // `--check`, compared and left alone. It happens AFTER the report and BEFORE
  // the exits, so the states that make this exit 1 are RECORDED rather than
  // suppressed: a run that refuses still says, in a committed file, what it
  // refused over.
  const fresh = buildDirectionResult({
    report,
    pending,
    exemptionsDeclared: EXEMPTIONS_DECLARED,
    script: relative(REPO_ROOT, join(import.meta.dir, "check-reference-direction.ts")),
    scriptAbsPath: join(import.meta.dir, "check-reference-direction.ts"),
  });
  const where = relative(REPO_ROOT, qaResultPath(INSTANCE_ROOT, SIDECAR_STEM));
  if (!check && !scoped) writeQaResult(INSTANCE_ROOT, SIDECAR_STEM, fresh);
  // The message names WHAT was compared. A `--check` that passed silently
  // would be read as a guarantee about the counts, which it is not and by
  // design cannot be.
  console.log(
    `\n  sidecar: ${where}` +
      `\n    graded — every (file, target) wrong-direction pair (A.10), the PENDING entries that` +
      ` no longer qualify, the instances with no \`needs\`; the unlisted multi-destination files are recorded` +
      `\n    recorded, NOT graded — the verdict counts, which move whenever the corpus does`,
  );
  // `--check` answers ONE question, and since bean `0dav` it is: did THIS
  // change add a graded state? — a file newly naming a layer above it
  // (A.10, single or multi destination), a `PENDING` entry newly no longer qualifying, a
  // layer newly declaring no `needs`. Against a baseline: the committed
  // working copy until QA leaves `main`, `--against <ref>` (a `qa-reports`
  // ref) after. It used to be "is the committed ruling what this run
  // computed", and that question has no subject once nothing is committed —
  // a baseline that is not there is UNKNOWN, reported and not gated
  // (proposal §2.3).
  //
  // `pending-held` is graded in the record but not here: membership moves only
  // when somebody edits `PENDING`, and that edit is in the diff under review.
  //
  // It still does not fail on the INHERITED backlog, for `audit-coverage --check`'s
  // reason: a gate that refused every push until somebody drained a backlog is
  // a gate switched off within a week. The backlog exit below is the PLAIN
  // form's, and the `✗` lines above print either way, so a `--check` that
  // returns 0 cannot be mistaken for a clean axis.
  if (check) {
    if (states.pendingStale.length > 0 || states.multiDestinationUnlisted.length > 0) {
      console.log(
        `\n  (the ${states.pendingStale.length + states.multiDestinationUnlisted.length} state(s) above are RECORDED, not graded here —` +
          ` \`bun run cat check:reference-direction\` is the form that exits 1 on them)`,
      );
    }
    console.log("");
    return judgeQaResult({
      gate: `${GATE}:check`,
      fresh,
      failOnNew: [...CHECK_FAIL_ON_NEW],
      baseline: { root: INSTANCE_ROOT, stem: SIDECAR_STEM, writer: GATE, against },
      rekeyBaseline: (b) => {
        const moved = rekeyMovedPairs(b, moveEvidence());
        const split = rekeyToolSplits(moved.result, fresh);
        return {
          result: split.result,
          note:
            `${moved.rekeyed} entr(y/ies) on a moved file compared at the file's new path (ruling (i), 2026-10-11); ` +
            `${split.rekeyed} on a Tool split into its folder (bean tdir)`,
        };
      },
    }).exit;
  }
  // Unchanged, and deliberately so: recording a state is not resolving it.
  if (states.pendingStale.length > 0 || states.multiDestinationUnlisted.length > 0) return 1;

  if (args.includes("--strict") && wrong.length > 0) {
    console.error(`\n✗ ${wrong.length} wrong-direction reference(s). A lower instance may not name one that depends on it.`);
    return 1;
  }
  return 0;
}

if (import.meta.main) process.exit(main());
