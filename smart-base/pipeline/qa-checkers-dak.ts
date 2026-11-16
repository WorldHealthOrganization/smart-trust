/**
 * QA checkers for the `dak` adapter — WHO SMART Guidelines L2/L3 blocks.
 *
 * The adapter-scoping machinery landed before anything was registered in it,
 * which meant `dak` blocks would sweep clean by default: every paper criterion
 * correctly `n/a`, and no DAK criterion to take its place. A corpus that
 * reports no findings because nothing was asked is the exact false pass the
 * §5 integration contract exists to prevent, so these are the first axes that
 * actually ask something.
 *
 * ## What these check, and what they deliberately leave alone
 *
 * Structural presence and well-formedness — does the manifest have the
 * artefact its kind promises, does the artefact parse, does it declare the
 * thing its kind says it declares. **Not** semantic conformance: whether a
 * profile is valid against its base, whether a CQL library compiles, whether
 * a DMN table is complete over its inputs. Those need the real validators
 * (`fhir-validation`, SUSHI, a DMN engine) and belong to the L3 pipeline in
 * `fhir-harness/processes/content/l3-fhir-pipeline.bpmn`, not to a grep.
 *
 * Reimplementing them here would produce a second, weaker verdict that
 * disagrees with the authoritative one — the argument §2c of the ingestion
 * proposal makes against a second copy of the corpus, applied to validation.
 *
 * ## The `depends_on` trap, deliberately walked around
 *
 * `dak-companion-present` exists to catch a manifest whose artefact is
 * missing. It therefore must NOT declare that artefact in `depends_on`, which
 * gates applicability: doing so would `n/a` exactly the blocks it exists to
 * flag. It depends on `ts` (always present) and looks for the companion
 * itself. That is what `also_invalidated_by` is for, and it is the case
 * `schemas/block-qa.ts` documents.
 *
 * ## Contributed, not imported
 *
 * This was core's `cat-harness/content/pipeline/qa-checkers-dak.ts` until bean
 * `1335`. The five `dak-*` CRITERIA stay declared in core's registry, marked
 * `checker_contributed` — the cut `folio-assistant-sci` already made for the
 * elaboration-cost checkers: a criterion is a rule, a checker is the tooling
 * that answers it. Each `smart-base/qa-checkers/` node names its entry in
 * {@link DAK_AUTOMATED_CHECKERS}, and `loadContributions` hands it to core
 * with this file as the checker's `sourceFile`, which is what keeps their
 * verdicts freshness-hashed (bean riit, step 3b).
 *
 * ## It also registers this layer's content types
 *
 * `loadContributions` requires this module for every repository that depends
 * on smart-base, when the QA sweep, the site publisher or the server starts.
 * That is this layer's load-time entry, so the `dak` and `sushi` content
 * types (`schemas/dak-content-type.ts`) are registered here, in the default
 * registry, before anything asks a repository what it is. Until this import
 * nothing outside the tests loaded that module, so the registry learned
 * `dak` only by accident (bean `cz17`).
 *
 * @module smart-base/pipeline/qa-checkers-dak
 */

import { existsSync, readFileSync } from "fs";
import type { CheckerPaths, CheckerResult } from "../platform/schema.js";
import "../schemas/dak-content-type";

import { DAK_LABEL_PREFIXES, type DakBlockKind } from "../schemas/dak-kinds";

/**
 * The companion each DAK kind must carry to be more than a stub.
 *
 * **Only kinds whose artefact is genuinely one-file-per-block appear here**,
 * and the list is what real WHO content actually contains rather than what the
 * authoring skills describe. Measured across `smart-dak-immz`, `smart-dak-bds`
 * and the WHO SMART Immunizations L3 IG:
 *
 * | Kind | Artefact | Evidence |
 * |---|---|---|
 * | `business-process` | `.bpmn` | 8 processes, 8 files |
 * | `cql-library` | `.cql` | 279 files, pairing 1:1 by stem with 279 `.fsh` Library instances |
 * | FHIR kinds | `.fsh` | 739 files |
 *
 * ## The FHIR rows invert when the renderer lands
 *
 * Today a `.fsh` is the authored source of the L3 IG, so requiring one is
 * right. The target (§12.15 of the ingestion proposal) makes the content block
 * the source and the IG a **render output** — at which point requiring an
 * authored block to carry its own `.fsh` is the analogue of requiring a paper
 * block to ship its own `.tex`.
 *
 * `.bpmn`, `.dmn` and `.cql` stay authored either way; `.fsh` and `.xlsx`
 * cross the line. This is flagged rather than changed, because enforcing the
 * target state against corpora that are correctly formed for the current one
 * would report defects in both.
 *
 * ## Why `decision-table` is NOT here
 *
 * An earlier version required a `.dmn` for `decision-table` and
 * `scheduling-logic`, on the strength of this repo's own `dmn-authoring` skill
 * and the "Decision logic · DMN tables" activity in
 * `smart-base/L2/collab/processes/l2-dak-authoring.bpmn`. Measured against real content there
 * are **zero `.dmn` files across all three repositories** — WHO authors
 * decision-support logic as a spreadsheet
 * (`input/decision-logic/IMMZ DAK_decision-support logic.xlsx`). The
 * requirement would have failed every decision-table block for a missing
 * artefact WHO does not produce.
 *
 * The deeper reason those kinds cannot have a required companion is that one
 * workbook holds **many** blocks: a single decision-support spreadsheet covers
 * every decision table, one dictionary covers every data element, one
 * indicators file covers every indicator. A per-block companion does not
 * exist until an extraction stage splits them, which is the DAK counterpart of
 * Stage B and is not built. Requiring one now would report a defect in every
 * such block, in a corpus that is correctly formed.
 */
export const REQUIRED_COMPANION: Partial<
  Record<DakBlockKind, "bpmn" | "fsh" | "cql" | "feature">
> = {
  "business-process": "bpmn",
  // TestScenario.fsh declares `feature 1..1 uri` — a link to a Gherkin feature
  // file. Unlike the workbook-backed kinds below, this is one file per scenario
  // in WHO's own model, so the requirement is real rather than premature.
  "test-scenario": "feature",
  "cql-library": "cql",
  "logical-model": "fsh",
  profile: "fsh",
  "value-set": "fsh",
  questionnaire: "fsh",
  "structure-map": "fsh",
  "plan-definition": "fsh",
  measure: "fsh",
  "actor-definition": "fsh",
};

/**
 * Kinds whose **source** artefact lives inside a shared workbook rather than a
 * file of their own. Recorded so the omission above reads as a measurement
 * rather than an oversight.
 *
 * ## Corrected once already
 *
 * An earlier note here claimed no per-block artefact exists for these until an
 * extraction stage is built. That is true of the *source* and false of the
 * DAK as published: WHO's own tooling already splits the workbook, generating
 * one FHIR instance per row — `IMMZ DAK_functional and non-functional
 * requirements.xlsx` row 73 becomes
 * `input/fsh/requirements/IMMZ.FXNREQ.075.D.fsh`, 262 of them in
 * `smart-dak-immz`.
 *
 * So a `functional-requirement` block *does* get a per-block artefact — a
 * generated one. It still must not be *required* here, because it is a
 * derived representation rather than the authored source, and because the
 * generator is WHO's rather than this platform's. {@link isGeneratedArtefact}
 * is what keeps QA from judging it as authored content.
 */
export const WORKBOOK_BACKED_KINDS: readonly DakBlockKind[] = [
  "decision-table",
  "scheduling-logic",
  "data-element",
  "indicator",
  "functional-requirement",
  "non-functional-requirement",
];

const pass = (): CheckerResult => ({ result: "pass", hits: [] });

/**
 * Markers WHO's DAK tooling leaves on FHIR it generates from L2 sources.
 *
 * Measured on `smart-dak-immz`: **266 of 536 `.fsh` files carry one** — 262
 * requirements plus 4 terminology resources — with lines like
 * `//functional requirment instance generated from row 73` naming the source
 * row of `IMMZ DAK_functional and non-functional requirements.xlsx`, and
 * descriptions reading "Autogenerated from DAK artifacts". (The WHO SMART
 * Immunizations L3 IG carries none: its FSH is authored.)
 *
 * The spelling `requirment` is WHO's, and matching it verbatim is deliberate —
 * a normalised regex would stop matching if they fix the typo, which is the
 * wrong failure direction for a detector whose job is to be conservative.
 */
const GENERATED_MARKERS = [
  /generated from row\s+\d+/i,
  /autogenerated from DAK artifacts/i,
];

/**
 * True when an artefact is machine-generated from an L2 source.
 *
 * QA must not judge these as authored content. A finding on a generated file
 * is unactionable — the fix is in the spreadsheet row or in the generator, and
 * a `fail` recorded against the artefact points at neither. It is the same
 * rule this repo already applies to its own generated files (`.jsonld`
 * siblings, `docs/reference/skills/*`): never hand-edited, so never reviewed
 * as though it were.
 *
 * Conservative by construction: only an explicit marker counts. Inferring
 * "generated" from a path or a naming convention would silently exempt
 * authored content from review, which is the costlier mistake.
 */
export function isGeneratedArtefact(path: string | undefined): boolean {
  const src = read(path);
  if (!src) return false;
  const head = src.slice(0, 4000);
  return GENERATED_MARKERS.some((re) => re.test(head));
}

/** A skip that records WHY, so a reader can tell it from "nothing wrong". */
function generated(role: string): CheckerResult {
  return {
    result: "n/a",
    hits: [],
    notes: `.${role} is generated from an L2 source — review the source or the generator, not this file`,
  };
}


function fail(file: string, line: number, text: string): CheckerResult {
  return { result: "fail", hits: [{ file, line, text }] };
}

function read(path: string | undefined): string | undefined {
  if (!path || !existsSync(path)) return undefined;
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return undefined;
  }
}

/** Kind, read from the manifest source. Cheap and good enough for dispatch. */
function kindOf(tsPath: string | undefined): string | undefined {
  const src = read(tsPath);
  if (!src) return undefined;
  const m = src.match(/export\s+default\s+([A-Za-z][A-Za-z0-9]*)\s*\(/);
  if (!m) return undefined;
  // Builder name → kind. Only the kebab-case DAK kinds differ from their
  // builder, so invert the prefix table's key set via the builder map.
  return m[1];
}

/**
 * The manifest declares a kind whose artefact is missing.
 *
 * A `business-process` with no `.bpmn` is a title and a label — it looks like
 * content in every listing and carries none. Applies only to the kinds in
 * {@link REQUIRED_COMPANION}; workbook-backed kinds are exempt by measurement,
 * not by omission.
 */
export function checkDakCompanionPresent(paths: CheckerPaths): CheckerResult {
  const builder = kindOf(paths.ts);
  if (!builder || !paths.ts) return pass();
  const kind = BUILDER_TO_DAK_KIND[builder];
  if (!kind) return pass(); // not a DAK block — the adapter gate handles it
  const required = REQUIRED_COMPANION[kind];
  if (!required) return pass();
  if (paths[required]) return pass();
  return fail(
    paths.ts,
    1,
    `${kind} block declares no .${required} companion — the manifest carries a label and no artefact`,
  );
}

/** `.bpmn` parses as XML and declares at least one process. */
export function checkDakBpmnHasProcess(paths: CheckerPaths): CheckerResult {
  const src = read(paths.bpmn);
  if (!src) return pass();
  if (isGeneratedArtefact(paths.bpmn)) return generated("bpmn");
  if (!/<\?xml/.test(src.slice(0, 200))) {
    return fail(paths.bpmn!, 1, ".bpmn does not begin with an XML declaration");
  }
  if (!/<(?:\w+:)?process\b/i.test(src)) {
    return fail(paths.bpmn!, 1, ".bpmn declares no <process> element");
  }
  return pass();
}

/** `.dmn` declares a decision with a decision table, not just a definitions shell. */
export function checkDakDmnHasDecisionTable(paths: CheckerPaths): CheckerResult {
  const src = read(paths.dmn);
  if (!src) return pass();
  if (!/<(?:\w+:)?decision\b/i.test(src)) {
    return fail(paths.dmn!, 1, ".dmn declares no <decision> element");
  }
  if (!/<(?:\w+:)?decisionTable\b/i.test(src)) {
    return fail(
      paths.dmn!,
      1,
      ".dmn has a <decision> but no <decisionTable> — the logic is not expressed",
    );
  }
  return pass();
}

/**
 * `.fsh` declares a resource of the kind the block claims.
 *
 * Catches the copy-paste error that a schema cannot: a block labelled
 * `vs:danger-signs` whose `.fsh` actually declares a `Profile`.
 *
 * ## Why this stays coarse
 *
 * Five kinds map to `Instance:`, so this cannot tell a PlanDefinition from a
 * Measure. Strengthening it to check `InstanceOf:` was the obvious next step
 * and real content says no: across the WHO SMART Immunizations IG, `InstanceOf` names a
 * **profile URL** far more often than a resource type — 138
 * `cpg-recommendationdefinition`, 41 `proportion-measure-cqfm`, alongside 279
 * bare `Library`. A check keyed on resource-type names would have produced 138
 * false failures on a correctly-formed corpus.
 *
 * Discriminating properly means resolving profiles to their base resources,
 * which is SUSHI's job and the L3 pipeline's. This checker stays a presence
 * check on purpose.
 */
const FSH_DECLARATION: Partial<Record<DakBlockKind, RegExp>> = {
  profile: /^\s*Profile\s*:/m,
  "value-set": /^\s*ValueSet\s*:/m,
  questionnaire: /^\s*Instance\s*:/m,
  "logical-model": /^\s*Logical\s*:/m,
  "structure-map": /^\s*Instance\s*:/m,
  "plan-definition": /^\s*Instance\s*:/m,
  measure: /^\s*Instance\s*:/m,
  "actor-definition": /^\s*Instance\s*:/m,
};

export function checkDakFshDeclaresKind(paths: CheckerPaths): CheckerResult {
  const src = read(paths.fsh);
  if (!src || !paths.ts) return pass();
  if (isGeneratedArtefact(paths.fsh)) return generated("fsh");
  const builder = kindOf(paths.ts);
  const kind = builder ? BUILDER_TO_DAK_KIND[builder] : undefined;
  if (!kind) return pass();
  const expected = FSH_DECLARATION[kind];
  if (!expected) return pass();
  if (expected.test(src)) return pass();
  return fail(
    paths.fsh!,
    1,
    `${kind} block's .fsh declares no ${String(expected).replace(/[/^\\s*:m]/g, "")} — kind and artefact disagree`,
  );
}

/**
 * The label prefix matches the kind the builder introduces.
 *
 * The Zod schema enforces this at construction, so this catches the manifest
 * that was hand-edited afterwards — the same reason the paper side re-checks
 * things its builders already validate.
 */
export function checkDakLabelPrefixMatchesKind(paths: CheckerPaths): CheckerResult {
  const src = read(paths.ts);
  if (!src || !paths.ts) return pass();
  const builder = kindOf(paths.ts);
  const kind = builder ? BUILDER_TO_DAK_KIND[builder] : undefined;
  if (!kind) return pass();
  const label = src.match(/label\s*:\s*["']([^"']+)["']/)?.[1];
  if (!label) return pass();
  const expected = `${DAK_LABEL_PREFIXES[kind]}:`;
  if (label.startsWith(expected)) return pass();
  return fail(
    paths.ts,
    1,
    `${kind} block is labelled "${label}" but must start with "${expected}"`,
  );
}

// Builder name → DAK kind, built from the canonical prefix table's keys so a
// new kind cannot be added here and forgotten there.
const BUILDER_TO_DAK_KIND: Record<string, DakBlockKind> = Object.fromEntries(
  (Object.keys(DAK_LABEL_PREFIXES) as DakBlockKind[]).map((kind) => [
    kind.replace(/-(.)/g, (_, c: string) => c.toUpperCase()),
    kind,
  ]),
);

/** Dispatch map, merged into the sweep's checker table. */
export const DAK_AUTOMATED_CHECKERS: Record<
  string,
  (paths: CheckerPaths) => CheckerResult
> = {
  "dak-companion-present": checkDakCompanionPresent,
  "dak-bpmn-has-process": checkDakBpmnHasProcess,
  "dak-dmn-has-decision-table": checkDakDmnHasDecisionTable,
  "dak-fsh-declares-kind": checkDakFshDeclaresKind,
  "dak-label-prefix-matches-kind": checkDakLabelPrefixMatchesKind,
};
