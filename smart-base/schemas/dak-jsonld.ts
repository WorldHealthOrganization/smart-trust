/**
 * JSON-LD typing for the `dak` adapter's block kinds.
 *
 * Moved out of core's `cat-harness/schemas/jsonld.ts` with the kinds themselves
 * (bean `1335`). Core's `typesForKind` still answers for every kind, a
 * DAK one included, but it learns a DAK kind's types from the CONTRIBUTION —
 * each kind's `folio-block-kind/v1` node in `smart-base/block-kinds/` carries
 * its `folioType` and `docoType`, registered by `loadContributions` (bean
 * riit) — so core no longer names a DAK kind to do it.
 *
 * @module smart-base/schemas/dak-jsonld
 * @graphNode schema
 */

import { SMART_BASE_NS } from "../platform/schema.js";
import { DAK_BLOCK_KIND_NODES, DAK_BLOCK_KINDS, type DakBlockKind } from "./dak-kinds";

/**
 * `smart-base:` type for each DAK kind, minted in smart-base's own namespace (bean `0r7u`).
 *
 * Folio's own classes rather than FHIR's, deliberately. A `value-set` *block*
 * is the authored unit that carries the label, the editorial edges and the QA
 * sidecar; the FHIR `ValueSet` is what its `.fsh` companion compiles to. Typing
 * the block as `fhir:ValueSet` would assert that a manifest is a FHIR resource,
 * which it is not — and would invite a consumer to read FHIR fields off it.
 * The link to the resource is the companion, not the type.
 */
export const DAK_KIND_TO_FOLIO_TYPE = Object.fromEntries(
  DAK_BLOCK_KIND_NODES.map((n) => [n.kind, n.folioType]),
) as Record<DakBlockKind, string>;

/**
 * The WHO logical model each DAK kind corresponds to, as a canonical IRI.
 *
 * WHO's IG publisher post-processes `smart-base`'s logical models into JSON
 * Schema and JSON-LD. Inspecting `generate_logical_model_schemas.py`, the
 * generated `@type` is a plain string carrying only an *example*
 * (`LogicalModel-HealthInterventions`), while `resourceDefinition` is a `const`
 * pinned to the StructureDefinition's canonical URL. **The canonical URL is the
 * stable identifier**, and it is the same one `DAKComponentSources.fsh` uses as
 * `canonical ^type[0].targetProfile`.
 *
 * So a block keeps its `smart-base:` `@type` — it is a manifest, not a FHIR resource
 * — and gains this as a separate assertion: *the thing this block is an
 * authored instance of*. That makes a folio DAK joinable with WHO's published
 * vocabularies instead of merely parallel to them.
 *
 * Deliberately **partial**. Ten of WHO's logical models name a component; kinds
 * without one — the L3 FHIR artefacts, and `scheduling-logic`, which WHO's model
 * still folds into decision support (the owner counts it as its own component;
 * see `DAK_UNFORMALIZED_COMPONENTS`) — get no entry rather than a fabricated IRI. An
 * unverified IRI never goes in a published graph.
 */
export const DAK_KIND_TO_WHO_MODEL: Partial<Record<DakBlockKind, string>> = {
  "health-intervention": `${SMART_BASE_NS}HealthInterventions`,
  persona: `${SMART_BASE_NS}GenericPersona`,
  "user-scenario": `${SMART_BASE_NS}UserScenario`,
  "business-process": `${SMART_BASE_NS}BusinessProcessWorkflow`,
  "data-element": `${SMART_BASE_NS}CoreDataElement`,
  "decision-table": `${SMART_BASE_NS}DecisionSupportLogic`,
  indicator: `${SMART_BASE_NS}ProgramIndicator`,
  "functional-requirement": `${SMART_BASE_NS}FunctionalRequirement`,
  "non-functional-requirement": `${SMART_BASE_NS}NonFunctionalRequirement`,
  "test-scenario": `${SMART_BASE_NS}TestScenario`,
};

/**
 * DoCO co-type for DAK kinds — even more sparing than the paper side.
 *
 * Only the three that really are document components in DoCO's sense get one.
 * A `decision-table` renders as a table, and a `business-process` and a
 * `logical-model` as figures. The rest are guideline artefacts rather than
 * parts of a document's layout, and co-typing them `doco:Section` would be a
 * stretch that puts wrong triples in a published graph.
 */
export const DAK_KIND_TO_DOCO_TYPE: Partial<Record<DakBlockKind, string>> = Object.fromEntries(
  DAK_BLOCK_KIND_NODES.flatMap((n) => (n.docoType ? [[n.kind, n.docoType]] : [])),
);

/** DAK kinds with no DoCO counterpart — most of them, by design. */
export const DAK_KINDS_WITHOUT_DOCO_TYPE = DAK_BLOCK_KINDS.filter(
  (k) => !DAK_KIND_TO_DOCO_TYPE[k],
);

