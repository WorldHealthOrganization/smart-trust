/**
 * The `dak` adapter's vocabulary — its block kinds, their builder names and
 * label prefixes, and the WHO DAK components they represent.
 *
 * These tables lived in core's `cat-harness/schemas/block-kinds.ts` until bean
 * `1335` (stage D of the smart-* separation, #1767). Core's content model named
 * the `dak` adapter, so `dak-blocks.ts` could not leave for smart-base without
 * core importing a harness. They reach core now the other way round: smart-base
 * CONTRIBUTES the adapter and its kinds as nodes — `content-adapters/dak.json`
 * and `block-kinds/` (bean riit, steps 3 and 5) — which `loadContributions`
 * registers through a folio's dependency tree, and core reads them from a
 * `ContributionRegistry` rather than from a module constant. See
 * `cat-harness/docs/proposals/dak-kinds-contribution-2026-10-02.md`.
 *
 * Since bean riit, step 3, the kinds and their builder, prefix and RDF types are
 * `folio-block-kind/v1` nodes in `smart-base/block-kinds/`, read here, and
 * `loadContributions` registers them for a folio whose dependency tree
 * includes smart-base. A leaf module, importing only the node schema and the
 * directory scan (and `dak-blocks.ts` for a TYPE), for the same reason
 * `block-kinds.ts` is one: `dak-blocks.ts` builds Zod schemas from these at
 * module initialisation, which is exactly when an import cycle bites.
 *
 * @module smart-base/schemas/dak-kinds
 * @graphNode schema
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { BlockKindNodeSchema, builderOf, type BlockKindNode } from "../platform/schema.js";
import { ownDeclaredDirectories } from "../platform/schema.js";
import type { DakBlock } from "./dak-blocks";

/** The content adapter these kinds belong to. Contributed, not built in. */
export const DAK_ADAPTER = "dak";

const SMART_BASE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The `dak` adapter's block kinds — WHO SMART Guidelines L2 and L3.
 *
 * Taken from the component lists this repo already treats as canonical:
 * `smart-base/L2/schemas/skills/l2-dak-authoring/input.schema.json` (the nine DAK
 * components) and `fhir-harness/schemas/skills/l3-fhir-authoring/input.schema.json` (the
 * ten FHIR artefact types). WHO's own starter kit could not be consulted
 * directly — `smart.who.int` and `build.fhir.org` return the same 403 policy
 * denial as `who.int` — so these mirror the repo's schemas, not the published
 * IG.
 *
 * ## Declared, not yet authorable
 *
 * These kinds are **not** members of the `Block` union and have no builder,
 * no Zod schema and no viewer registration. Authoring a DAK block is a
 * separate piece of work; what exists today is the vocabulary, so that QA
 * criteria can be scoped by adapter and so the ingest writer has names to
 * emit. `walkBlocks` will not discover a `.ts` declaring one of these until
 * that work lands — which is the honest state, rather than a kind that looks
 * supported and silently yields nothing.
 */
export const DAK_BLOCK_KIND_NODES: readonly BlockKindNode[] = readOwnKindNodes();

/**
 * The kinds, read off smart-base's own `block-kinds/` nodes (bean riit, step
 * 3; owner, 2026-10-04: *"kinds need to be discoverable … not centrally
 * managed"*). Sorted by kind. Adding a DAK kind is adding a node.
 */
export const DAK_BLOCK_KINDS = DAK_BLOCK_KIND_NODES.map((n) => n.kind) as unknown as readonly [
  DakBlockKind,
  ...DakBlockKind[],
];

/** A DAK kind: the TYPE the `DakBlock` union declares (a type-only import, erased at runtime). */
export type DakBlockKind = DakBlock["kind"];

/**
 * Builder function name for each DAK kind, from each node's `builder`.
 *
 * DAK kinds are multi-word (`decision-table`), and a hyphen is not a valid
 * identifier, so the kind stays kebab-case because it is *data* and the
 * builder is camelCase because it is an *identifier*. Anything scanning a
 * `.ts` for `export default <builder>(` maps back through core's
 * `kindForBuilder`, which learns them from the registry; deriving one from the
 * other by string munging is what the node's `builder` field prevents.
 */
export const DAK_KIND_BUILDERS = Object.fromEntries(
  DAK_BLOCK_KIND_NODES.map((n) => [n.kind, builderOf(n)]),
) as Record<DakBlockKind, string>;

/**
 * Label prefix for each DAK kind, without the colon, from each node.
 *
 * None collide with the paper and structural prefixes — asserted by test.
 */
export const DAK_LABEL_PREFIXES = Object.fromEntries(
  DAK_BLOCK_KIND_NODES.map((n) => [n.kind, n.labelPrefix]),
) as Record<DakBlockKind, string>;

/** smart-base's `folio-block-kind/v1` nodes of the `dak` adapter, from the `block-kinds` graph its declaration names. */
function readOwnKindNodes(): BlockKindNode[] {
  const out: BlockKindNode[] = [];
  for (const dir of ownDeclaredDirectories(SMART_BASE_ROOT, "block-kinds")) {
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    } catch {
      continue;
    }
    for (const f of files) {
      const parsed = BlockKindNodeSchema.safeParse(JSON.parse(readFileSync(join(dir, f), "utf-8")));
      if (!parsed.success) throw new Error(`${join(dir, f)} is not a folio-block-kind/v1 node: ${parsed.error.message}`);
      if (parsed.data.adapter === DAK_ADAPTER) out.push(parsed.data);
    }
  }
  if (out.length === 0) throw new Error(`no ${DAK_ADAPTER} block kinds under ${SMART_BASE_ROOT}: its block-kinds graph is missing or empty`);
  return out.sort((a, b) => a.kind.localeCompare(b.kind));
}

// ── WHO DAK components, and this repo's coverage of them ─────────

/**
 * The WHO SMART Guidelines DAK components, in WHO's own order.
 *
 * The canonical list is eight components as published, plus **test scenarios**,
 * added later. Four WHO-side sources state it and they do not all agree, so the
 * list is pinned here rather than recited:
 *
 * | Source | Says |
 * |---|---|
 * | `smart-base` `input/fsh/models/DAK.fsh` | These nine, ending `testScenarios` — its own description says "all 9 DAK components" |
 * | `smart-ig-starter-kit` `l2_dak_authoring.md`, **the table** | These nine, identically numbered |
 * | `smart-ig-starter-kit` `l2_dak_authoring.md`, **the intro prose** | A different nine: scheduling logic promoted to #7, test scenarios absent — stale, and contradicted by the table directly beneath it |
 * | `sgex` `.github/copilot-instructions.md` | Eight (predates test scenarios), *plus* a second list of artefact types that is not the components at all |
 *
 * Three of the four agree, including both machine-readable ones — but the
 * owner ruled, 2026-09-30, that the DAK has **ten**: the original eight, plus
 * scheduling logic and test scenarios (issue #1614). Scheduling logic is
 * authored as DMN decision tables but is not yet formalized as its own L2
 * logical-model field or L3 artefact, so it is listed here AND named in
 * {@link DAK_UNFORMALIZED_COMPONENTS}; the other nine match `DAK.fsh`
 * field for field. Anything counting components against one source alone is
 * off by one, silently.
 *
 * Published guidance:
 * - <https://www.who.int/publications/i/item/9789240099456>
 * - <https://www.who.int/publications/i/item/9789240085138>
 * - <https://www.who.int/publications/i/item/9789240020306>
 *
 * This exists to make coverage answerable rather than assumed:
 * {@link DAK_COMPONENT_KINDS} maps each component to the block kinds that
 * represent it, and a component mapping to none is a documented gap, not an
 * oversight nobody noticed.
 */
export const DAK_COMPONENTS = [
  "health-interventions-and-recommendations",
  "generic-personas",
  "user-scenarios",
  "generic-business-processes-and-workflows",
  "core-data-elements",
  "decision-support-logic",
  "scheduling-logic",
  "programme-indicators",
  "functional-and-non-functional-requirements",
  "test-scenarios",
] as const;

export type DakComponent = (typeof DAK_COMPONENTS)[number];

/**
 * Components the owner counts that WHO's `DAK` logical model does not yet
 * declare as a field of their own (owner, 2026-09-30, #1614). Each still has a
 * {@link DAK_COMPONENT_FIELDS} entry — the name the field would take — so
 * `index.config.json` (`contentTypes.dak`) can carry it; the check against
 * `DAK.fsh` skips these and checks the rest field for field. When WHO
 * formalizes one, it leaves this list.
 */
export const DAK_UNFORMALIZED_COMPONENTS: readonly DakComponent[] = ["scheduling-logic"];

/**
 * The field each component occupies in WHO's own `DAK` logical model.
 *
 * From `smart-base` `input/fsh/models/DAK.fsh`, where every component is
 * declared `0..* <Name>Source`. Carrying the field names makes this table
 * checkable against WHO's model rather than merely parallel to it, and gives a
 * DAK read from `index.config.json` (`contentTypes.dak`) somewhere to land.
 */
export const DAK_COMPONENT_FIELDS: Record<DakComponent, string> = {
  "health-interventions-and-recommendations": "healthInterventions",
  "generic-personas": "personas",
  "user-scenarios": "userScenarios",
  "generic-business-processes-and-workflows": "businessProcesses",
  "core-data-elements": "dataElements",
  "decision-support-logic": "decisionLogic",
  // Not in `DAK.fsh` yet — see DAK_UNFORMALIZED_COMPONENTS.
  "scheduling-logic": "schedulingLogic",
  "programme-indicators": "indicators",
  "functional-and-non-functional-requirements": "requirements",
  "test-scenarios": "testScenarios",
};

/** One-line statement of what each component is for, in WHO's terms. */
export const DAK_COMPONENT_DESCRIPTIONS: Record<DakComponent, string> = {
  "health-interventions-and-recommendations":
    "Links clinical and public health guidance to specific digital actions.",
  "generic-personas":
    "Defines the target users, such as primary healthcare workers, clients, or managers.",
  "user-scenarios":
    "Illustrates how different personas interact with digital tools in real-world settings.",
  "generic-business-processes-and-workflows":
    "Maps out step-by-step clinical and administrative routines.",
  "core-data-elements":
    "Lists required variables mapped to international terminology standards like ICD.",
  "decision-support-logic":
    "Outlines logical rules, alerts, and algorithms for clinical guidance.",
  "scheduling-logic":
    "Decision tables (DMN) that schedule follow-up visits and services by care plan; not yet formalized as its own L2 or L3 artefact.",
  "programme-indicators":
    "Specifies metrics used to evaluate health program performance and reporting.",
  "functional-and-non-functional-requirements":
    "Details system specifications, performance bounds, and security needs.",
  "test-scenarios":
    "Exercises the guidance end to end; added after the original eight components.",
};

/**
 * Which block kinds represent each WHO component.
 *
 * Deliberately **not** one-to-one in either direction:
 *
 * - `functional-and-non-functional-requirements` is one WHO component that
 *   this repo splits into two kinds, because the component's own name is a
 *   conjunction and the two halves have different reviewers.
 * - `scheduling-logic` is its own component (owner, 2026-09-30), holding the
 *   `scheduling-logic` kind. It was folded into `decision-support-logic` until
 *   then, because WHO's SOP table and `DAK.fsh` both keep it there; the owner
 *   counts it separately because it is authored separately, as its own DMN
 *   decision tables, even though no L2/L3 artefact formalizes it yet.
 * - `core-data-elements` collects everything describing a variable's shape,
 *   including the L3 `structure-map` that transforms between two of them.
 *
 * Coverage is asserted by test: every kind lands in exactly one component, and
 * exactly one component — `health-interventions-and-recommendations` — names
 * no kind at all. `dakComponentsWithoutL2` reports the sharper gap: components
 * with no *L2* kind, which is that one plus `test-scenarios`.
 */
export const DAK_COMPONENT_KINDS: Record<DakComponent, readonly DakBlockKind[]> = {
  "health-interventions-and-recommendations": ["health-intervention"],
  "generic-personas": ["persona", "actor-definition"],
  "user-scenarios": ["user-scenario"],
  "generic-business-processes-and-workflows": ["business-process", "plan-definition"],
  "core-data-elements": [
    "data-element",
    "logical-model",
    "profile",
    "value-set",
    "questionnaire",
    "structure-map",
  ],
  "decision-support-logic": ["decision-table", "cql-library"],
  "scheduling-logic": ["scheduling-logic"],
  "programme-indicators": ["indicator", "measure"],
  "functional-and-non-functional-requirements": [
    "functional-requirement",
    "non-functional-requirement",
  ],
  "test-scenarios": ["test-scenario", "test-case"],
};

