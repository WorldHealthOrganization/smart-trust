#!/usr/bin/env bun
/**
 * Dump the layer's knowledge graph to one JSON file, for publication.
 *
 * The export is **data**, not a rendered document: `folio` is the only
 * `renderable` graph kind and it belongs to the content core, so the harness
 * does not render its own graph. Something else may draw it.
 * (`generate-registry.ts`'s `.claude/skills/registry.json` stays a runtime
 * manifest.)
 *
 * The publication rules — which layer's document is published where, under
 * which base, with which schema, and what is stripped — are in
 * `skills/kg/kg-core/instance-publication.md` §"What each instance
 * publishes". This module carries the mechanics.
 *
 * ## The edges are the point
 *
 * BPMN activities carry `<bootstrap.processes:skill ref="…"/>` and sit in a lane, so the
 * export says **which process step is implemented by which skill, performed
 * by which role**. `check:workflow-refs` guarantees those refs resolve, so
 * this does not re-validate them.
 *
 * ## Three states
 *
 * A source that cannot be read is **reported in `problems[]` and counted**,
 * never silently dropped, so a consumer can tell it is looking at part of a
 * graph.
 *
 * ## Judge mode — `bun run cat kg:export:judge`
 *
 * `--judge` builds the export IN MEMORY, judges it and writes nothing: no
 * `_kg/` document, no QA sidecar. 0 no fatal finding · 1 a root field or a
 * term outside the `@context`, or a keyword/alias collision · 2 an unread
 * source (could not determine), an unknown flag, or a run that threw. It
 * accepts `--base-url`, `--instance` and `--scope`; `--out` and `--qa-root` are a
 * writer's flags and are refused.
 *
 * As the `kg:export:check` gate it judges the committed
 * `kg-export*.qa-results.json` sidecars under the declared `test/results/`.
 *
 * @covers qa
 *
 * @module scripts/kg-export
 * @covers cat-harness, schemas, skills, processes, tools — the declaration and the graphs its
 *   collectors read; the judge form audits the EXPORT of them (its `@context` closure and keyword
 *   use), not each node's own validity, which `kg:audit` and `check:kind-validators` own
 *
 * @conformsTo dcmi-terms
 * @conformsTo omg-bpmn-2.0
 * @conformsTo schema-org
 * @conformsTo w3c-prov-o
 * @conformsTo w3c-rdfs
 * @conformsTo w3c-xsd11-datatypes
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { PROVENANCE_INLINE_STYLE, provenanceSectionFor } from "./provenance-footer.ts";
import { tmpdir } from "node:os";
import { basename, join, dirname, normalize, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { propertyIri, termIri } from "../schemas/kg/namespaces.js";
import { ownPrefixTable } from "../schemas/kg/graph-typology-registry.js";
import { SOFTWARE_LIBRARY_SUBJECT_KIND, softwareLibraryNodes } from "./lib/software-library-nodes.ts";
import { STANDARD_PREFIXES, applyVocabMapping, contextBindings, vocabMapping, type VocabMapping } from "../schemas/content/vocab-mapping.js";
import { readPolicyGrants } from "../schemas/content/odrl.js";
import { TRANSLATION_SUBJECT_KIND, translationNodes } from "./lib/translation-nodes.ts";
import { attestationNodes } from "./lib/attestation-nodes.ts";
import { VOICE_SUBJECT_KIND, voiceNodes } from "./lib/voice-nodes.ts";
import { KG_CONTENT_GRAPH_TYPOLOGIES, declaredAssets, declaredGraphs, declaredKinds, repoRootFor, resolveDirectories, declarationPathIn } from "../schemas/kg/cat-harness.js";
import { type DependsOnGap, type DependsOnRecord, dependsOnFor } from "../schemas/kg/depends-on.js";
import { type RoleDef, actorsDir, capabilitiesDir, readRoleGraph } from "../schemas/process/role-graph.js";
import { REGISTRY_GROUPS } from "../schemas/kg/kg-node.js";
import {
  artefactStub,
  defaultGraphTypologies,
  graphTypologyIri,
  isPublishedDirectory,
  isPublishedGraphTypology,
  isPublishedSchemaModule,
  isPublishedSkill,
  forgeLocation,
  layerRootsIn,
  readDeclaration,
  renderingPath,
  siteDirFor,
  UNPUBLISHED_GRAPH_TYPOLOGIES,
} from "../schemas/kg/cat-harness.js";
import { firstHeading, frontMatter } from "./front-matter.js";
import { packageDirsIn } from "./skill-topics.js";
import { isExternalContract, layerContracts, skillContracts } from "./skill-contracts.js";
import {
  isSkillMd,
  kgDirectories,
  kgRoots,
  knownSkills,
  skillMdDirs as knownSkillDirs,
  workflowDirs,
  unpublishedSkills,
  corpusScopeFor,
  roleGraphFor,
  type CorpusScope,
} from "./known-skills.js";
import { auditSchemaNodes } from "./schema-nodes.js";
import { loadSpecs } from "./external-schemas.js";
import { declaredNamespaces } from "../schemas/kg/external-schema.js";
import { toolsOf } from "../tools/discover.js";
import { toolDocumentPath, toolIri } from "../schemas/tools/tool-folders.js";
import { declaresOwnCanonical, instanceDocPath, publishesInstanceSchema } from "./instance-exports.js";
import {
  buildDeclarationSchema,
  buildInstanceSchemas,
  instanceSchemaIndexIri,
  renderZodSchemas,
  scanInstanceZodSchemas,
  skillIoIri,
  type InstanceSchemaExport,
  type ZodSchemaScan,
} from "./harness-schema-export.js";
import { stagingContextTerm, stagingFields } from "./staging-stamp.js";
import { schemaPageDetails, schemaSectionHtml } from "./lib/schema-page.ts";
import {
  QA_RESULTS_DIR,
  buildQaResult,
  concludeJudgement,
  judgementOf,
  judgeUsage,
  qaResultPath,
  judgeQaResult,
  readQaResult,
  writeQaResult,
  type Judgement,
  type QaResult,
} from "./qa-results.js";
import { isGlobalTasksFile, loadGlobalTasks, loadProcessModel } from "../src/workflow/process-model.js";
import { listDecisions } from "../src/workflow/decision-table.js";
import {
  checkoutRootFor,
  corpusDirectoriesForGraph,
  declaredSubgraph,
  subgraphSourceOverrides,
  type DeclaredSubgraph,
  implementingRootFor,
} from "../schemas/kg/harness-config.js";
import { contentSourceContext, contentSourceJsonLd, resolveSubgraphSource, type SubgraphSource } from "../schemas/kg/subgraph-source.js";
import { subgraphIri } from "./subgraph-node.js";
import { subjectBase, subjectFileStem, subjectIri, subjectPathOf } from "./lib/subject-iri.ts";
import { THEME_SUBJECT_KIND, themeNodes } from "./lib/theme-nodes.ts";
import { placedOut } from "./lib/moved-document.ts";
import { hostSchemaBase } from "./lib/host-schema.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import { diagramPages, owningProcess } from "./lib/diagram-pages.ts";
import { darkRules } from "./lib/scheme-css.ts";

const ROOT = join(HARNESS_ROOT);

/**
 * Directories holding a skill's **instruction body** (`<name>.md`), DISCOVERED
 * rather than listed.
 *
 * Three times now a hardcoded list has been the bug. First this module listed
 * six directories and missed `schemas/skills/`, reporting 11 BPMN refs as
 * dangling. Then, with that fixed, the same list still omitted
 * a DAK base layer's `skills/content/authoring-who-smart-guidelines/` and its
 * siblings, so that layer's `-tools` package — a file that plainly exists — came out as a dangling
 * `declaresSkill` link. `knownSkills()` in `scripts/check-workflow-refs.ts`
 * carries a fourth, differently-wrong copy of the same list.
 *
 * A list of locations is a fact about the tree, and facts about the tree
 * belong to the tree. So: every subdirectory of `skills/` plus the two
 * out-of-tree homes. Adding a package now requires changing nothing here,
 * which is the only version of this that stops being wrong.
 */
/**
 * Every directory holding skill instruction bodies, from the ONE function that
 * decides — `scripts/known-skills.ts`.
 *
 * This had its own copy, and the copies disagreed in both directions. It
 * scanned every `skills/*` subdirectory (so it saw packages the hardcoded
 * `SKILL_MD_DIRS` missed) and hardcoded `.claude/skills/local` alone (so it
 * missed groups the deny-list there admits). Measured 2026-09-19 by creating
 * `.claude/skills/probegroup/probe-skill.md`: `knownSkills()` resolved it and
 * this export did not — a skill by the repository's own definition, absent
 * from the graph it publishes.
 *
 * Two readers with two copies of "where skills live" is the exact failure
 * `known-skills.ts` was extracted to prevent, restated one module along.
 */
function skillMdDirs(root: string = ROOT, scope: CorpusScope = corpusScopeFor(root)): string[] {
  return knownSkillDirs(root, scope).map((p) => p.join("/"));
}

/*
 * A skill's **I/O contract** — `input.schema.json` and `output.schema.json` —
 * is the other facet of a skill, not another kind of skill: a name may have an
 * instruction body, an I/O contract, or both. Keying the graph by name rather
 * than by file is what lets the two meet. The contract is found through the
 * skill's own ref (`skillContracts`), wherever it sits (bean `cat-tools-st4q`).
 */


/**
 * Directories holding BPMN processes, DISCOVERED.
 *
 * This was the literal `docs/workflows`, and a sibling PR moved the diagrams
 * to `processes/` while this branch was open. A hardcoded path does not
 * fail when its target moves — it finds nothing and reports a clean run over
 * zero processes, which is bean `dh4f` exactly. That is the FOURTH hardcoded
 * path in this module to be wrong; the pattern is now a rule: this exporter
 * locates corpora, it does not remember where they were.
 */
/**
 * Directories holding this layer's `.bpmn`, read from its DECLARATION.
 *
 * ## Measured: the walk this replaces was leaking, in `main`, today
 *
 * It walked the filesystem — every directory under the root to depth 4, minus
 * a skip list of *names*. That was right while this repository was the only
 * layer in the tree. `bootstrap/` is now a second one, with its own
 * declaration, and the walk does not know that: measured 2026-09-19 on `main`,
 * `_kg/folio-assistant.jsonld` contained **88** references to
 * `Process_CatBootstrap`. CatBootstrap's process was being published as part of
 * folio-assistant's graph.
 *
 * The repair that suggests itself is `skip.add("bootstrap")` — a directory
 * name written in code, which is the defect `check:declared-paths` exists to
 * refuse, and which would need another line for every layer ever added.
 * Reading the declaration needs none: a layer's diagrams are the ones it
 * DECLARES, and a directory it does not declare is not its graph.
 */
function findBpmnDirs(root: string = ROOT, scope: CorpusScope = corpusScopeFor(root)): string[] {
  return workflowDirs(root, scope).map((abs) => relative(root, abs));
}


// ── JSON-LD context ─────────────────────────────────────────────

/** The namespace a declared graph typology's nodes belong in. */
/** A kind's individual, `<layer ns>graphTypology/<name>` — the registry's one answer. */
export function graphTypologyId(kindName: string): string {
  return graphTypologyIri(kindName, defaultGraphTypologies.get(kindName));
}

/** A type IRI with whichever folio namespace it carries removed. */
export function stripNamespace(iri: string): string {
  for (const ns of Object.values(ownPrefixTable())) if (iri.startsWith(ns)) return iri.slice(ns.length);
  return iri;
}

const PROV = "http://www.w3.org/ns/prov#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const SCHEMA = "https://schema.org/";
const XSD = "http://www.w3.org/2001/XMLSchema#";

/**
 * A vocabulary-mapping table of THIS layer (the platform's), read once.
 * Own rather than the exported layer's: a table belongs to the `vocab-map`
 * Tool that applies it, which lives here, so `--instance ./bootstrap` names
 * its roles with the same rows (`vocabMappingDirs`).
 */
const namingTables = new Map<string, VocabMapping>();
function namingTable(id: string): VocabMapping {
  let m = namingTables.get(id);
  if (m === undefined) namingTables.set(id, (m = vocabMapping(ROOT, id)));
  return m;
}

/**
 * The active context, following the WHO DAK base IG's
 * `generate_jsonld_vocabularies.py`.
 *
 * Four things here are load-bearing rather than decorative:
 *
 * **`{"@type": "@id"}` is what makes this a graph.** Without it every edge —
 * `requires`, `performedBy`, `partOf` — is a *string literal* to any
 * JSON-LD processor, and the document is a list of records that merely looks
 * linked to a human reading the JSON. Declaring those terms `@id`-typed is the
 * difference between 500 records and a traversable graph, and it costs one
 * line each.
 *
 * **No `@vocab`.** Every term is declared with its full namespace IRI, so an
 * undeclared key stays undeclared rather than silently resolving against a
 * default namespace and minting an IRI nobody chose. That IG's type-usage
 * document calls this out explicitly and it is the right call.
 *
 * **`id` and `type` are aliased** to `@id` and `@type`, so the published JSON
 * reads as ordinary records while remaining RDF. A reader who does not know
 * JSON-LD is not taxed for it.
 *
 * **`@version: 1.1`** because aliasing and scoped type-coercion are 1.1
 * features; a 1.0 processor must fail loudly rather than half-read the file.
 */
export function buildContext(): Record<string, unknown> {
  const link = { "@type": "@id" } as const;
  const prefixes = { ...ownPrefixTable(), prov: PROV, rdfs: RDFS, schema: SCHEMA, xsd: XSD };
  return {
    "@version": 1.1,
    ...prefixes,

    id: "@id",
    type: "@type",
    graph: "@graph",

    // `name`, `title`, `description` and `summary`, then a role's
    // `prefLabel` and `notation`: DERIVED from the vocabulary-mapping tables
    // rather than restated here (bean `lodp`). `kg-node-naming` is the row
    // fsh-guts reads too, so "exactly as the main export" is structural
    // (finding D2); `role-naming` is the row glossary-export reads too, so
    // one role node is not named two ways (D3). Dublin Core, not a second
    // `rdfs:label`/`rdfs:comment` (owner, 2026-09-30, bean `xsqm`:
    // "emphasize preexisting standards … now align"). The edges below that
    // restate a standard — `partOf`, `holdsGraph`, `from`/`to`,
    // `bindsRole`, … — resolve through `propertyIri`, which reads each
    // retired term's `replacedBy` in the vocabulary; the JSON keys are
    // unchanged, so a plain-JSON reader sees no difference and an RDF reader
    // sees the standard property.
    ...contextBindings([namingTable("kg-node-naming"), namingTable("role-naming")], {
      inContext: prefixes,
      prefixes: { ...STANDARD_PREFIXES, ...ownPrefixTable() },
    }),
    generatedAt: { "@id": `${PROV}generatedAtTime`, "@type": `${XSD}dateTime` },
    // Provenance of the SOURCE, as against provenance of the run above.
    sourceCommit: { "@id": `${PROV}wasDerivedFrom`, "@type": "@id" },
    sourceCommitSha: termIri("sourceCommitSha"),
    sourceCommitAt: { "@id": termIri("sourceCommitAt"), "@type": `${XSD}dateTime` },
    sourceTreeDirty: { "@id": termIri("sourceTreeDirty"), "@type": `${XSD}boolean` },
    sourceTree: termIri("sourceTree"),
    sourceCommitUnavailable: termIri("sourceCommitUnavailable"),

    // §3.4's published dependency set. `uri` is a LINK — it is the thing a
    // consumer dereferences, and a bare string here would be the `inSubgraph`
    // mistake: a second, unresolvable way of naming something that resolves.
    // `version` is NOT redeclared here: it is already `schema:softwareVersion`
    // above, and a dependency's version is a software version. A second
    // `folio:version` beside it would be two names for one term in one
    // document — the exact drift the single term table exists to stop.
    dependsOn: termIri("dependsOn"),
    packageId: termIri("packageId"),
    uri: { "@id": termIri("uri"), ...link },
    dependsOnGaps: termIri("dependsOnGaps"),
    dependsOnUnavailable: termIri("dependsOnUnavailable"),

    // Edges. Each of these is a LINK, not a string — see above.
    partOf: { "@id": propertyIri("partOf"), ...link },
    // A LINK, not a literal, and the gate was right to demand the decision:
    // the declared Directory nodes are already in this graph (they are what
    // `collectDeclaration` emits), so a bare id would have been a second,
    // unresolvable way of naming a node that is right there. As a link the
    // viewer's subgraph facet and the declaration hierarchy are the same edge.
    inSubgraph: { "@id": propertyIri("inSubgraph"), ...link },
    // Task → Skill. `dcterms:requires` — "a related resource that is
    // required by the described resource to support its function" — read as
    // the task, the DEPENDENT node, naming what it needs; the skill names no
    // task. Owner, 2026-10-16 (thread "BPMN lane, role and skill modelling",
    // implementation spec §2): this replaces `implementedBy`, because a skill
    // does not implement a task, and a general standard is preferred over
    // minting `completedUsing`. Through `propertyIri`, like every replaced
    // term: the vocabulary's `requires` is `replacedBy: dcterms:requires`.
    requires: { "@id": propertyIri("requires"), ...link },
    performedBy: { "@id": termIri("performedBy"), ...link },
    declaresSkill: { "@id": termIri("declaresSkill"), ...link },
    inPackage: { "@id": termIri("inPackage"), ...link },
    providesCapability: { "@id": termIri("providesCapability"), ...link },
    requiresCapability: { "@id": termIri("requiresCapability"), ...link },
    // `CapabilityDefinition.fallbackTo` — the capability that stands in for
    // this one. A LINK for the same reason `requiresCapability` is: the
    // value is a capability id and every Capability is a node in this
    // document, so it resolves. Bean `folio-assistant-sym3`, which moved it
    // off five skill modules onto the one capability it describes.
    fallbackToCapability: { "@id": termIri("fallbackToCapability"), ...link },
    satisfies: { "@id": termIri("satisfies"), ...link },
    // The role REGISTRY's edge, and the lane's edge to it. `hasSkill` is what
    // the role knows; `bindsRole` is on the LANE, naming the role it binds
    // (its `<bootstrap.processes:role ref>`). It was `bindsLane` on the role until #1168: a
    // role is the general node and must not name its lanes (data-modelling
    // step 8).
    //
    // REUSED, not coined. `schemas/process/role-graph.ts`'s own JSON-LD projection
    // already publishes exactly these two relations under these two IRIs, so
    // a second spelling here would put one concept in the vocabulary twice --
    // the drift this repo keeps paying for. `ns:check` is what caught it, by
    // naming two minted terms as undefined; the reflex is to write the two
    // glosses rather than to go looking for what they duplicate.
    //
    // Links for `partOf`'s reason: a bare name leaves a consumer to re-derive
    // the IRI this document already minted.
    hasSkill: { "@id": termIri("hasSkill"), ...link },
    bindsRole: { "@id": propertyIri("bindsRole"), ...link },
    inLane: { "@id": termIri("inLane"), ...link },
    // A LINK: the artefact's published URL, which dereferences. Undeclared it
    // would be dropped by any JSON-LD processor — the `ovkk` defect, where 34
    // property names were used in `@graph` and absent from `@context`, so the
    // document lost nearly all its property data the moment anything treated
    // it as JSON-LD rather than as plain JSON.
    maintains: { "@id": termIri("maintains"), ...link },
    // A LITERAL, deliberately: a repo-relative module path is not
    // dereferenceable, and coercing it to `@id` would resolve it against the
    // document IRI and mint a URL that nothing serves.
    maintainsFrom: termIri("maintainsFrom"),
    // The inverse of `maintains`, on a Schema node. A LINK: it names a Tool
    // node in this same document.
    maintainedBy: { "@id": termIri("maintainedBy"), ...link },
    // A LINK, on a Schema node: the published JSON Schema rendering of each of
    // its module's public `*Schema` exports (`<stub>/schema/zod/…`).
    jsonSchema: { "@id": termIri("jsonSchema"), ...link },
    // A LITERAL: a repo-relative module path, for the same reason
    // `maintainsFrom` is one.
    module: termIri("module"),
    holdsGraph: { "@id": propertyIri("holdsGraph"), ...link },
    startNode: { "@id": termIri("startNode"), ...link },
    incoming: { "@id": propertyIri("incoming"), ...link },
    outgoing: { "@id": propertyIri("outgoing"), ...link },
    from: { "@id": propertyIri("from"), ...link },
    to: { "@id": propertyIri("to"), ...link },
    // The preview → canonical link. `prov:alternateOf`, NOT `owl:sameAs`:
    // sameAs entails identity, so a reasoner would merge every statement about
    // both nodes and a changed description in a preview would make the merged
    // graph assert two conflicting descriptions of one thing. alternateOf says
    // "same underlying thing, different presentation" and merges nothing.
    alternateOf: { "@id": `${PROV}alternateOf`, ...link },
    canonicalDocument: { "@id": termIri("canonicalDocument"), ...link },
    // A served COPY of a subject document names its canonical one: the same
    // document at another address, so `owl:sameAs` is right here where it is
    // wrong for `alternateOf` above. See `writeSubjectDocuments`.
    sameAs: { "@id": `${STANDARD_PREFIXES.owl}sameAs`, ...link },

    // ── The standards a graph is written in, and what validates it ──────
    //
    // Owner, 2026-09-27, looking at the `processes` GraphTypology: *"i would have
    // expected to see schemas more accessible (e.g. bpmn, or others) when
    // viewing"*. The registry knew `processes` is BPMN and the exporter
    // dropped it. `conformsTo` and `validator` are LINKS to nodes this
    // document carries (ExternalSchema, Schema); the rest are literals.
    conformsTo: { "@id": propertyIri("conformsTo"), ...link },
    validator: { "@id": termIri("validator"), ...link },
    validatorRef: termIri("validatorRef"),
    validatorNotApplicable: termIri("validatorNotApplicable"),
    authority: termIri("authority"),
    specVersion: termIri("specVersion"),
    specUse: termIri("specUse"),
    specUrl: termIri("specUrl"),
    namespace: termIri("namespace"),

    // A skill's I/O contract, as a LINK to the published schema document.
    //
    // These were missing, and their absence was invisible in a way worth
    // recording. `collectSkills` has always set `inputSchema`/`outputSchema`
    // on the 22 skills that have a contract, and the values appeared in the
    // emitted file — so reading the export as plain JSON showed the edge and
    // everything looked correct. But a term that is neither in the `@context`
    // nor an absolute IRI is **dropped** by JSON-LD processing, so the
    // association evaporated on the one consumer path this export exists to
    // serve. It was written, published, and not there.
    //
    // Both halves had to be fixed together: a term here with a relative value
    // would resolve against the document IRI and give
    // `<base>/schemas/skills/…`, which nothing serves. The values are now
    // the published `$id` of each contract — see `skillIoIri`.
    inputSchema: { "@id": termIri("inputSchema"), ...link },
    outputSchema: { "@id": termIri("outputSchema"), ...link },

    // The registry's own fields, renamed on the way in — see
    // `collectRegistryNodes`. Literals, not links: `localId` is a name within
    // a kind, not an IRI.
    localId: termIri("localId"),
    // TWO terms, and the distinction is load-bearing rather than clumsy: an
    // actor IS one kind of thing, a role ADMITS several. Collapsing them into
    // one name would assert that a lane open to a person and an agent is
    // itself some third kind of actor.
    actorKind: termIri("actorKind"),
    actorKinds: termIri("actorKinds"),
    // A LITERAL, not a link. It is a value from a closed vocabulary
    // (`NETWORK_REACHES`), not a node — minting `#reach/air-gapped` would
    // create an IRI nobody declared and invite a consumer to dereference it.
    // It is also NOT the deployment's `network`, although the vocabulary is
    // shared: that one describes a population, this one a participant.
    reach: termIri("reach"),
    // The declared exemption: `judgementOnly` says the role acts but no
    // procedure yields its answer, so `activity-names-skill` is `n/a`. Its
    // sibling `actedUpon` ("never acts") was retired on 2026-10-16 (owner): a
    // role a machine plays is a real role whose skills are its contract.
    judgementOnly: { "@id": termIri("judgementOnly"), "@type": `${XSD}boolean` },

    // ---- BPMN, as it comes off a diagram -----------------------------------
    //
    // Literals, all of them. `bpmnType` is a QName in the BPMN namespace
    // (`bpmn:UserTask`), NOT an IRI: coercing it to `@id` would resolve it
    // against this document and mint `<base>/bpmn:UserTask`, which nothing
    // serves. `nodeKind` was emitted as the bare term `kind`, which this
    // document already uses in another sense -- a GraphTypology is a "kind" too --
    // so the term now says which one it is.
    bpmnType: termIri("bpmnType"),
    // Convention terms (bean `3190`). All LITERALS — none is a link, so none
    // gets `{"@type": "@id"}`: a bare name under `@id` resolves against the
    // document base and mints an IRI nobody chose.
    //
    // `statement` is NOT a synonym of `rdfs:comment`. The comment is prose
    // ABOUT the node; the statement is the rule ITSELF, and a consumer
    // filtering for enforceable text needs them apart. `rationale` is
    // separate again for a reason worth stating: a rule and its justification
    // collapsed into one field is a rule nobody can retire, because there is
    // nothing left that says what would falsify it.
    statement: termIri("statement"),
    rationale: termIri("rationale"),
    applies: termIri("applies"),
    nodeKind: termIri("nodeKind"),
    enforcement: termIri("enforcement"),
    workPlanOp: termIri("workPlanOp"),
    touchesWorkPlan: { "@id": termIri("touchesWorkPlan"), "@type": `${XSD}boolean` },
    relaxable: { "@id": termIri("relaxable"), "@type": `${XSD}boolean` },
    nodeCount: { "@id": termIri("nodeCount"), "@type": `${XSD}integer` },
    flowCount: { "@id": termIri("flowCount"), "@type": `${XSD}integer` },
    // A LITERAL: the ref as authored, a DMN path relative to the diagram plus
    // the decision's own id (`decisions/draft-qa-gate.dmn#Decision_DraftQaGate`).
    // Coercing it would resolve that path against the document IRI and mint
    // an IRI nothing serves. The comment here said it "becomes a link on the
    // day decision tables are nodes"; that day is 2026-09-27 (owner: each DMN
    // table a node, linked to its gateway and to DMN 1.3), and the link is a
    // SEPARATE term, `decidedBy`, so this one's published meaning does not
    // change under anybody reading it.
    decisionRef: termIri("decisionRef"),
    decidedBy: { "@id": termIri("decidedBy"), ...link },
    hitPolicy: termIri("hitPolicy"),
    // A call activity's target, as a LINK to the Process node it invokes —
    // BPMN's own `calledElement`, so the standard property rather than a
    // minted one. Written only when that Process is in this graph, for
    // `decidedBy`'s reason: a call to a process nobody declares is a diagram
    // defect (`kg-qa`'s to report), not a link to mint (bean `ax6r`).
    calledElement: { "@id": propertyIri("calledElement"), ...link },
    // The SVG `render:bpmn` drew from a diagram, and the diagram on its forge.
    // LINKS, both: each is a URL a reader opens, which is what the workflow
    // page does with them (bean `ax6r`).
    depiction: { "@id": termIri("depiction"), ...link },
    sourceUrl: { "@id": termIri("sourceUrl"), ...link },
    // WHERE A NODE CAME FROM, and the two senses are not one term. A Process
    // carries the `.bpmn` path it was loaded from; a Role carries the string
    // `role-registry` (and a lane-derived Role, until #1168 B9b, carried
    // `bpmn-lane`), which is a provenance KIND and not a path. Both
    // were emitted as `source`, so a single declaration would have asserted
    // that `bpmn-lane` is a file. Literals, for `maintainsFrom`'s reason: a
    // repo-relative path is not dereferenceable.
    sourcePath: termIri("sourcePath"),
    sourceKind: termIri("sourceKind"),

    // ---- Skills, packages, directories -------------------------------------
    //
    // `instructionsPath` is a repo-relative path, so a LITERAL for exactly
    // `maintainsFrom`'s reason. It was `instructions`, a name that promises the
    // text itself and delivers a path.
    instructionsPath: termIri("instructionsPath"),
    // A declared directory's README, relative to the layer root: the page a
    // person reads about that directory, generated by `subgraph-readmes`.
    // Present only when the file exists, so its absence is a fact, not a gap.
    readmePath: termIri("readmePath"),
    // Where a declared subgraph gets its content — `dcterms:source`, with its
    // `kind`/`branch` scoped (bean `l4ay`; `schemas/kg/subgraph-source.ts`).
    contentSource: contentSourceContext(),
    instructionLines: { "@id": termIri("instructionLines"), "@type": `${XSD}integer` },
    // How many COMMITTED files a declared directory holds, at any depth. Bean
    // `ba9e`: the directory READMEs printed this, and a count in a committed
    // file changes on every commit that adds a file, so almost every merge
    // conflicted on one of 54 READMEs. The export is built at publish time
    // and committed nowhere, so here the number cannot conflict. Absent when
    // git could not answer — never a zero standing in for "unknown".
    fileCount: { "@id": termIri("fileCount"), "@type": `${XSD}integer` },
    hasInstructions: { "@id": termIri("hasInstructions"), "@type": `${XSD}boolean` },
    hasIOContract: { "@id": termIri("hasIOContract"), "@type": `${XSD}boolean` },
    ambiguous: { "@id": termIri("ambiguous"), "@type": `${XSD}boolean` },
    hasManifest: { "@id": termIri("hasManifest"), "@type": `${XSD}boolean` },
    renderable: { "@id": termIri("renderable"), "@type": `${XSD}boolean` },
    // A repo-relative directory, on a Directory and on a SkillPackage. ONE term
    // because it is one relation in both places -- unlike `source` above, which
    // was one name over two relations.
    path: termIri("path"),
    // A declared ASSET's role, and a LITERAL rather than a link.
    //
    // `assetRole` and not `role`, which is the one decision in this term. An
    // asset's role is a free string naming what the FILE is for —
    // `agent-instructions`, `instance-readme`, `landing-operations` — and it is
    // a different vocabulary from the actor/swimlane Role, which is a node
    // with an id, skills and actor kinds. Spelling both `role` would make a
    // consumer that resolves the term get a bare string where it expects a
    // Role node, and the two would be indistinguishable in the graph.
    //
    // A literal because `KgAssetSchema.role` is `z.string().min(1)` with no
    // enum behind it, so there is no node set for a value to name. Coercing it
    // to `@id` would resolve each bare name against the document base and mint
    // an IRI nobody chose — which is the failure the export's own undeclared
    // -term report warns about by name.
    assetRole: termIri("assetRole"),
    // `schema:` is declared as a prefix above and this is its first use: a
    // package version is a software version and schema.org already has the
    // predicate. Minting `folio:version` beside it would be a second name for
    // a term the wider web already agrees on.
    version: `${SCHEMA}softwareVersion`,

    // ---- An actor's three lists, which answer three different questions ----
    //
    // `capabilities` becomes a LINK, because every value names a Capability
    // node this document contains -- 20 of 20, measured 2026-09-19. The VALUES
    // are minted as node IRIs in `collectRegistryNodes` rather than left as
    // bare names: a bare name under `{"@type": "@id"}` resolves against the
    // document base and yields `<base>/git-push`, which is the confidently
    // wrong coercion this bean warns about, not an edge.
    hasCapability: { "@id": termIri("hasCapability"), ...link },
    // Roles and permissions stay LITERALS, deliberately and provisionally. The
    // role registry (`scenarios/roles.json`) and the permission vocabulary
    // (`skills/permissions/permissions.json`) are NOT exported, so this graph
    // holds no node for any of them -- the Role nodes it does hold are BPMN
    // LANES, a different identity scheme with different names. Coercing would
    // mint 44 role and 21 permission IRIs resolving to nothing. They are names
    // until those registries are nodes, and `roleName`/`permissionName` say so
    // instead of implying an edge the graph cannot honour.
    roleName: termIri("roleName"),
    // An actor's roles, as LINKS since #1168 B8: the role registry IS exported
    // now (`collectDeclaredRoles`, one Role node per `scenarios/roles.json`
    // entry), and all 73 actor role references resolve to one — measured
    // 2026-09-30. The literal-only reasoning above holds for permissions.
    mayTakeRole: { "@id": termIri("mayTakeRole"), ...link },
    // A literal like `roleName`: requirement statements are not nodes of this
    // graph, so a `req:<id>#<key>` is a name here, not a link (#1168, B3).
    satisfiesStatement: termIri("satisfiesStatement"),
    permissionName: termIri("permissionName"),

    // ---- Structured values whose own vocabulary this graph does not model ---
    //
    // `{"@type": "@json"}` (JSON-LD 1.1, `rdf:JSON`) keeps the value verbatim.
    // The alternative -- declaring the container term alone -- is WORSE than
    // leaving it undeclared: the outer key survives, every inner key is
    // dropped, and a consumer gets a well-formed EMPTY node where a Tool's I/O
    // contract used to be, with nothing to say anything was lost. Modelling
    // `io.inputs[].schema` as real edges is worth doing and is not this change.
    io: { "@id": termIri("io"), "@type": "@json" },
    invoke: { "@id": termIri("invoke"), "@type": "@json" },
    // Heterogeneous by source, and that is the point: a Capability's `install`
    // is a command string, a Tool's is a dispatch object. The RELATION is the
    // same -- how do I get this -- so one term, with a range `@json` tolerates.
    // Contrast `sourcePath`/`sourceKind`, where the two senses were different
    // relations sharing a name and had to be split.
    install: { "@id": termIri("install"), "@type": "@json" },
    detection: { "@id": termIri("detection"), "@type": "@json" },
    meta: { "@id": termIri("meta"), "@type": "@json" },
    assignments: { "@id": termIri("assignments"), "@type": "@json" },
    // An actor's `systemUnderTest` facet (`{ kind, version }`, role-graph.ts):
    // which kind of system a test-plan actor exercises. Kept verbatim, like
    // the values above, until the test-plan join is modelled as edges.
    systemUnderTest: { "@id": termIri("systemUnderTest"), "@type": "@json" },
    // A Tool's environment requirements -- `{ runtime: ["go"], network: true }`.
    // NOT `requiresCapability`: `go` is not a capability id (0 of 1 runtime
    // names match a Capability node), so these are two relations wearing one
    // name. It was `requires`, which a Capability also carried in the other
    // sense -- see `collectRegistryNodes`.
    requirements: { "@id": termIri("requirements"), "@type": "@json" },

    // Which build produced this document — see `scripts/staging-stamp.ts`.
    //
    // **Declared, because the stamp was being dropped.** Until 2026-09-19 the
    // staging workflow appended `staging` to the document root with an inline
    // `bun -e`, and no term declared it: a JSON-LD processor discards a
    // property that is neither in the `@context` nor an absolute IRI, so the
    // one artefact this build stamped carried its stamp in the one form the
    // consumer this export exists to serve cannot read. Exactly the `ovkk`
    // defect recorded on `inputSchema`/`outputSchema` above, one level up on
    // the document root — where `undeclaredTerms` does not look, because it
    // walks `@graph`.
    //
    // A SCOPED context (JSON-LD 1.1 §4.1.8), not four global terms. `branch`,
    // `sha`, `pr` and `run` are words a graph node could plausibly use for
    // something else, and a global term would silently give that other use
    // this meaning. Scoped, they mean this only inside `staging`.
    staging: stagingContextTerm(),
    // What a staging preview's graph changed against the graph `main`
    // publishes — written by `scripts/kg-changed-assets.ts` after the export,
    // on a PREVIEW document only (owner, 2026-10-14). The `dependsOn` /
    // `dependsOnUnavailable` pair's shape: the list, and beside it why there
    // is no list, so an unreadable base never reads as "nothing changed".
    //
    // Scoped, for `staging`'s reason: `change`, `kind`, `before`, `after`,
    // `source` and `pages` are words a node could use for something else.
    // `before` / `after` / `title` are `StagingPageComparison`'s field names
    // (cat-harness `schemas/sdlc/staging.ts`), so a page row reads as one.
    changedAssets: {
      "@id": termIri("changedAssets"),
      "@container": "@list",
      "@context": {
        change: termIri("assetChange"),
        kind: termIri("assetKind"),
        source: termIri("assetSource"),
        before: { "@id": termIri("beforeVersion"), ...link },
        after: { "@id": termIri("afterVersion"), ...link },
        pages: { "@id": termIri("renderedPage"), "@container": "@list" },
        pagesUnknown: termIri("renderedPagesUnknown"),
      },
    },
    changedAssetsComparedWith: { "@id": termIri("changedAssetsComparedWith"), ...link },
    changedAssetsUnavailable: termIri("changedAssetsUnavailable"),

    // ---- The DOCUMENT ROOT's own fields ------------------------------------
    //
    // `ovkk` drove `@graph`'s undeclared count to zero. These six were the
    // same defect one level up, and they survived it for a structural reason:
    // `undeclaredTerms` walks `@graph`, so the root is the one place it cannot
    // look. Half the root WAS declared — `generatedAt`, `sourceCommit` and the
    // three `sourceCommit*` fields — which is what made the other half
    // invisible.
    //
    // `undeclaredRootTerms` now checks it, and is fatal for `undeclaredTerms`'
    // reason: with the count at zero, a new entry can only mean somebody added
    // a root field and did not decide what it means.
    //
    // A LINK, and `schema:codeRepository` rather than a minted `folio:` term —
    // the wider web already agrees on this one, exactly as `version` uses
    // `schema:softwareVersion`. It sits beside `sourceCommit`, which has been
    // declared all along; this was a gap, not a judgement.
    repository: { "@id": `${SCHEMA}codeRepository`, "@type": "@id" },
    // `{"@type": "@json"}`, for the reason `io` and `install` carry it: the
    // value is `{"Actor": 25, "Skill": 149, …}`, keyed by TYPE NAME, so there
    // is no fixed set of terms to declare. Declaring the container alone would
    // keep `counts` and drop all twelve numbers — a well-formed empty object
    // where the truncation check used to be, which is worse than leaving it
    // undeclared, because undeclared at least loses the whole thing visibly.
    counts: { "@id": termIri("counts"), "@type": "@json" },
    // `omitted` — the instance-bound collectors that were NOT run, present
    // only on a foreign layer's document. A plain list of collector names,
    // so a declared container is enough; there is no open key set as there is
    // for `counts`.
    //
    // It is a root field carrying real data, and `dyd3` is why it is here: it
    // came over from `gen-bootstrap-graph.ts` when that generator's publish
    // step was retired, because it was the one thing that document had which
    // this one did not. Adding it WITHOUT this line made `undeclaredRootTerms`
    // fatal on the first run — which is the guard working, and the reason the
    // field is not silently dropped by a JSON-LD processor instead.
    omitted: { "@id": termIri("omitted"), "@container": "@set" },
    // `sourceLanguage` — present only on a PER-LOCALE document, written by
    // `kg-locale-export.ts`, and it is the language of the document's UNTAGGED
    // strings rather than of its content. That distinction is the whole reason
    // it is a minted term and not `schema:inLanguage`: the wider web's term
    // says what language the content is in, and for `cat-harness.fr.jsonld`
    // the honest answer to that is French, while the answer this field gives
    // is English. Two different questions, so borrowing the term would make
    // every locale document assert something false to a consumer that
    // understood it.
    //
    // Declared here, in the CORE's context, because a locale document carries
    // the core's `@context` verbatim — `IDENTITY_KEYS` in the translating walk
    // protects it, since rewriting a context repoints every property in the
    // document. So there is one place terms are declared, and a locale
    // document cannot drift from it.
    //
    // `lvw0`: it was written and never declared, and `undeclaredRootTerms` did
    // not catch it because that guard ran against the core document only —
    // the `staging` shape of #340 exactly, one file over. A JSON-LD processor
    // dropped it, and `publish:verify` refused all four locale documents,
    // which skipped the deploy.
    sourceLanguage: { "@id": termIri("sourceLanguage") },
    //
    // `problems`, `undeclaredTerms`, `undeclaredSchemaModules` and
    // `danglingLinks` were declared here and are NOT any more — the document
    // no longer carries them. They are a QA reviewer's findings about the
    // graph this run produced, so they are written to `test/results/` as a
    // `qa-results/v1` document instead. See `publishedDocument`.
    //
    // The terms went WITH the fields, deliberately. A `@context` describes what
    // its document carries; a term for a field nothing emits is a promise to a
    // consumer that this document will answer a question it has stopped
    // answering, which is a worse kind of wrong than an undeclared term —
    // undeclared at least fails loudly against `undeclaredRootTerms`.
  };
}

/**
 * Root-level property names the `@context` does not declare.
 *
 * ## The blind spot this closes
 *
 * {@link undeclaredTerms} walks `@graph`, so the DOCUMENT ROOT is the one
 * place it structurally cannot look — and the root carries real data:
 * provenance, node counts, and every diagnostic this export produces. Half of
 * it was declared (`generatedAt`, the four `sourceCommit*` fields) and half
 * was not, which is precisely what kept the gap invisible: a spot check on any
 * declared field said the root was covered.
 *
 * It is not hypothetical. `staging` shipped through this gap in #340 — written
 * into the root by the staging workflow, declared nowhere, and therefore
 * dropped by the only consumer the export exists to serve — while this file's
 * own comments stated the rule it was breaking. Six more were found the moment
 * anyone looked: `repository`, `counts`, `problems`, `undeclaredTerms`,
 * `undeclaredSchemaModules`, `danglingLinks`.
 *
 * ## Why this is not a field on the document
 *
 * Same call {@link keywordCollisions} makes, for the same reason. A field
 * reporting undeclared root terms would itself be a root term needing
 * declaration, and would have to be computed before it existed. It is a
 * DOCUMENT-VALIDITY check, run against the assembled document at the point of
 * writing, and fatal there.
 *
 * Fatal for `undeclaredTerms`' reason, now that the count is zero: the only
 * thing a new entry can mean is that somebody added a root field and did not
 * decide what it means. Deciding costs one line in {@link buildContext}.
 */
/**
 * The document as PUBLISHED — the computation minus its QA findings.
 *
 * ## Why the findings left the document
 *
 * `undeclaredTerms`, `undeclaredSchemaModules`, `danglingLinks` and `problems`
 * are what a QA reviewer found about the graph this run produced. The owner's
 * rule, 2026-09-19: an artefact generated primarily as a QA reviewer belongs
 * under `test/results/` as part of a QA process. They are written there, as a
 * `qa-results/v1` document, by the CLI below.
 *
 * They are **not** dropped — they are relocated, and the relocation is checked:
 * a test asserts the result's families equal what this function strips out, so
 * nothing can leave the document without arriving in the result.
 *
 * ## What STAYS, and why the line is not "everything diagnostic"
 *
 * `counts` and `repository` stay. Neither is a finding: `counts` is what the
 * graph CONTAINS, which is how a consumer spots a truncated document, and
 * `repository` is provenance sitting beside `sourceCommit`. A reviewer's
 * verdict moves; a fact about the artefact does not.
 *
 * `sourceCommitUnavailable` stays for the same reason, and it is the sharpest
 * case: it reads like a problem and is not one. A tarball exports a complete
 * graph and simply cannot say which commit it came from.
 */
export function publishedDocument(data: Export): Omit<Export, "undeclaredTerms" | "undeclaredSchemaModules" | "danglingLinks" | "problems"> {
  const {
    undeclaredTerms: _ut,
    undeclaredSchemaModules: _usm,
    danglingLinks: _dl,
    problems: _p,
    ...doc
  } = data;
  return doc;
}

export function undeclaredRootTerms(
  doc: Record<string, unknown>,
  context: Record<string, unknown>,
): string[] {
  const declared = new Set(Object.keys(context).filter((k) => !k.startsWith("@")));
  return Object.keys(doc)
    // `@`-prefixed keys are JSON-LD keywords, which need no declaration — and
    // an ALIAS of one is handled by `keywordCollisions`, not here.
    .filter((k) => !k.startsWith("@") && !declared.has(k))
    .sort();
}

/**
 * Terms in the context that ALIAS a JSON-LD keyword.
 *
 * A node object carrying both a keyword and an alias of it is a
 * `colliding keywords` error (JSON-LD 1.1 §4.1.3), and the practical effect is
 * worse than an error: `{"@id": "<abs>", "id": "programme-manager"}` offers a
 * processor an absolute IRI and a relative one for the same node.
 *
 * Derived from `buildContext` rather than written out, so adding an alias
 * there cannot leave this list behind.
 */
function keywordAliases(): Set<string> {
  return new Set(
    Object.entries(buildContext())
      .filter(([, v]) => typeof v === "string" && v.startsWith("@"))
      .map(([k]) => k),
  );
}

/**
 * How a node's IRI is formed: **`<doc dir>/<kind>/<id>`**, a path beside the
 * published document — never a `#fragment` of it (litlfred/cat-harness-tools#603;
 * the rule is cat-harness `kg-export.md` §"Subject IRIs — a path, not a
 * `#fragment`"). A process's flow is the one exception, `…/process/P#flow/F`.
 *
 * It was `<doc>#<kind>/<id>`, because a path nothing serves is a 404 with an
 * `@id` in front of it — the README generator's twenty-three PDF 404s. That
 * reason still holds, so the export now SERVES every path it mints:
 * {@link writeSubjectDocuments} writes `<kind>/<id>.jsonld` and
 * `<kind>/<id>.html` beside the document. The old fragments are gone: a
 * clean break (owner, 2026-11-02, cat-harness-tools#1378), nothing forwards them.
 *
 * The form itself is `scripts/lib/subject-iri.ts`'s, so this and
 * `subgraph-node`'s `subgraphIri` cannot spell it two ways.
 */
export function makeIri(docIri: string, kind: string, id: string): string {
  return subjectIri(docIri, kind, id);
}

interface Node {
  "@id": string;
  "@type": string;
  [k: string]: unknown;
}

interface Export {
  "@context": Record<string, unknown>;
  /** This document's own IRI — the URL it is served from. */
  "@id": string;
  /**
   * `prov:Entity`, plus `folio:PreviewGraph` when this is not the canonical
   * publication — so "is this the real one?" is answerable from the type.
   */
  "@type": string | string[];
  /** On a preview: the canonical document this one is an alternate of. */
  canonicalDocument?: string;
  /**
   * The schema this layer's declaration and contracts are written against.
   * `dcterms:conformsTo`.
   *
   * - **A foreign layer** `instance-exports.ts` publishes a schema
   *   directory for (bean `4ak5` item 1): its index,
   *   `<stub>/schema/<stub>.schema.json` at its published identity.
   * - **The host**: its `<stub>.schema.json` — the shared declaration schema
   *   itself, at the `$id` `harness-schema-export.ts` mints for it with the
   *   same base (`buildDeclarationSchema`), so the link and the file cannot
   *   disagree (bean `4ak5` follow-up, owner-approved 2026-10-05).
   *
   * Absent with no base — an `@id` is absolute or absent, never relative — and
   * for the other two exemptions, which publish no schema directory.
   */
  conformsTo?: string;
  /**
   * Instance-bound collectors that were NOT run, for a foreign layer.
   *
   * Carried so a reader can tell *"this instance has no tools"* from *"tools
   * were never looked for"* — the `dh4f` defect, a clean run reported over a
   * corpus the tool could not read. It came here from
   * `gen-bootstrap-graph.ts` when `dyd3` retired that generator's publish
   * step: the field was the one thing that document had which this one did
   * not, so dropping the generator without it would have lost the guard.
   *
   * Absent for the host layer, where every collector runs and "omitted" is
   * not a question.
   *
   * **`schemas` leaves the list when the schemas ARE published** — when the
   * deploy writes this layer a `<stub>/schema/` directory and this document
   * links its index with `conformsTo` (bean `4ak5` follow-up, owner-approved
   * 2026-10-05). The module-level `Schema` collector still does not run here;
   * what a consumer needs is not "not looked for" but the link to where they
   * are. It stays when the Zod scan would be undetermined, because the index
   * then says `omitted: ["schemas"]` too, and the two must not disagree.
   */
  omitted?: readonly string[];
  repository: string;
  /**
   * When the export ran. Optional, and no longer written (owner rulings
   * 2026-11-06, cards "QA dates" and "Date source", option 1): the export
   * records {@link sourceTree}, and a reader derives the date from it, so the
   * same tree exports the same bytes on a PR and on main. Kept readable for
   * graphs exported before.
   */
  generatedAt?: string;
  /** The git tree the graph was exported from (`HEAD^{tree}`): what its content is a function of. */
  sourceTree?: string;
  /**
   * The commit the graph was generated from, as a dereferenceable IRI when the
   * repository's web host is known. `prov:wasDerivedFrom`, which is exactly
   * what it is.
   */
  sourceCommit?: string;
  /** That commit's SHA, unabbreviated. */
  sourceCommitSha?: string;
  /** When that commit was made — distinct from when this export ran. */
  sourceCommitAt?: string;
  /**
   * True when the working tree had uncommitted or untracked changes, so the
   * SHA above does NOT reproduce this graph. Absent means the question was not
   * answerable, which is not the same as `false`.
   */
  sourceTreeDirty?: boolean;
  /**
   * Why there is no source commit, when there is none.
   *
   * Carried here rather than in `problems` because it is not an unread source:
   * a tarball or an export-stripped checkout exports a complete graph, it just
   * cannot say which commit it came from. Present exactly when
   * `sourceCommitSha` is absent, so a consumer never has to infer the reason
   * for a missing field.
   */
  sourceCommitUnavailable?: string;
  /**
   * §3.4's published dependency set — `{packageId, version, uri}` per edge.
   *
   * Present only when THIS layer declares `publishable: true`. An undecided
   * layer emitting one would assert a published dependency set for
   * something nobody has said is published, which is the ceremony §3.1 is
   * written against — and `dependsOnUnavailable` says so in that case rather
   * than leaving an absent field to be read as "depends on nothing".
   */
  dependsOn?: readonly DependsOnRecord[];
  /**
   * Edges that could NOT become a record, each carrying which of the four
   * reasons applies.
   *
   * The `dh4f` rule applied to an edge: `dependsOn: []` beside four
   * unpublishable dependencies would state that this layer depends on
   * nothing, which is false. Present only alongside `dependsOn`.
   */
  dependsOnGaps?: readonly DependsOnGap[];
  /**
   * Why there is no `dependsOn`, when the reason is not an empty dependency
   * set.
   *
   * Same contract as `sourceCommitUnavailable`: present exactly when the field
   * it explains is absent for a reason, so a consumer never infers one. Today
   * every layer is undecided, so every export carries this — which is the
   * honest reading of the repository rather than a silence over it.
   */
  dependsOnUnavailable?: string;
  /** Node counts by `@type`, so a consumer can spot a truncated graph. */
  counts: Record<string, number>;
  /**
   * Property names used in `@graph` that the `@context` does not declare.
   *
   * **Every one of these is DROPPED when the document is processed as the
   * JSON-LD it says it is.** A term that is neither in the context nor an
   * absolute IRI is not a property; it simply disappears. Reading the file as
   * plain JSON shows it, which is why this goes unnoticed — `inputSchema` was
   * published and invisible for exactly this reason until #297.
   *
   * **Empty, and FATAL when it is not** — since bean `ovkk`, which closed the
   * backlog this field was opened to report. It was reported-not-fatal while
   * 34 names and 3583 occurrences were outstanding, because declaring a term
   * is modelling work per property and blocking publication on a backlog holds
   * the graph hostage to it. That backlog is gone, so the same reasoning now
   * points the other way: with the count at zero, the only thing a new entry
   * can mean is that somebody added a property and did not decide what it
   * means. Deciding costs one line in `buildContext`; shipping it undecided
   * costs a published graph that silently drops the property.
   *
   * This is NOT the call made for `danglingLinks`, and the difference is who
   * can fix it. A dangling link is a DATA defect — a manifest naming a skill
   * nobody wrote — which the exporter cannot resolve and must not hide. An
   * undeclared term is an EXPORTER defect, fixable in the same change that
   * introduced it.
   */
  undeclaredTerms: Array<{ term: string; onTypes: string[]; occurrences: number }>;
  /**
   * Modules in the declared `schemas/` directory that say nothing about
   * themselves, and `@graphNode none` entries with no reason.
   *
   * **Its own field rather than `problems`.** That field's contract is
   * "sources that could not be read", and an undeclared module is not an
   * unreadable one — the export saw it perfectly well. Widening `problems` is
   * the mistake `buildExport` already refuses to make for provenance, and it
   * would make `problems: []` meaningless as a signal.
   *
   * Reported and non-fatal, like `undeclaredTerms`: what is at stake is a node
   * missing from the graph, not a graph published as whole while partial.
   */
  undeclaredSchemaModules: Array<{ module: string; why: "no-tag" | "none-without-reason" }>;
  /** Sources that could not be read. NEVER empty-by-omission — see module doc. */
  problems: string[];
  /**
   * Internal links whose target node is not in `@graph`.
   *
   * Reported in the document rather than thrown, because these are **data**
   * defects, not export failures: a manifest naming a skill nobody wrote is
   * bean `nup0`'s subject and predates this tool. Blocking publication on them
   * would hold the graph hostage to a backlog. Reporting them makes the graph
   * its own referential-integrity check, which is most of what publishing a
   * real JSON-LD graph buys over a list of records.
   */
  danglingLinks: Array<{ from: string; edge: string; to: string }>;
  "@graph": Node[];
}

interface SkillFacts {
  instructions?: string;
  title?: string;
  description?: string;
  fmName?: string;
  lines?: number;
  packages: string[];
  inputSchema?: string;
  outputSchema?: string;
}

function collectSkills(
  doc: string,
  base: string,
  problems: string[],
  root: string = ROOT,
  scope: CorpusScope = corpusScopeFor(root),
  /**
   * The `--base-url` the deploy passes, for minting a FOREIGN layer's
   * contract at its published identity (`publishedInstanceSchemas`). Not
   * `base`: that is this document's, and a contract another layer holds is
   * published under that layer's.
   */
  baseUrl?: string,
): Node[] {
  const byName = new Map<string, SkillFacts>();
  const get = (n: string): SkillFacts =>
    byName.get(n) ?? (byName.set(n, { packages: [] }), byName.get(n)!);

  for (const dir of skillMdDirs(root, scope)) {
    const abs = join(root, dir);
    if (!existsSync(abs)) continue; // A package this layer does not carry.
    for (const f of readdirSync(abs)) {
      // `isSkillMd`, not a bare `.md` test. This carried its OWN copy of the
      // predicate — a third definition of "is this a skill" in a module whose
      // own header is about two definitions disagreeing — and it admitted
      // `bootstrap/README.md` as a skill named `README` the moment a second
      // knowledge-graph root existed. `skill-coverage.test.ts` caught it,
      // which is the only reason this is a comment rather than a published
      // graph node nobody could explain.
      if (!f.endsWith(".md") || !isSkillMd(join(abs, f))) continue;
      let text: string;
      try {
        text = readFileSync(join(abs, f), "utf-8");
      } catch (e) {
        problems.push(`unreadable skill ${dir}/${f}: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      const name = f.slice(0, -3);
      const s = get(name);
      const fm = frontMatter(text);
      // A name defined in two packages is recorded, not silently overwritten:
      // bare name is the identifier a BPMN ref uses, so a duplicate is a real
      // ambiguity somebody has to resolve.
      s.packages.push(dir);
      s.instructions ??= `${dir}/${f}`;
      s.fmName ??= fm.name;
      s.description ??= fm.description;
      s.title ??= firstHeading(text);
      s.lines ??= text.split("\n").length;
    }
  }

  // Each skill names its own contracts (`input:`/`output:` in its front
  // matter, #1168 B3b); nothing is inferred from a directory name. A local
  // contract publishes under the schemas base at its path below `schemas/`;
  // an external one is already an IRI.
  //
  // The PUBLISHED IRI, never the repo-relative path. A relative value here
  // resolves against this document's own IRI and names something nothing
  // serves; and since the context coerces these to `@id`, a relative value
  // would silently become a wrong absolute one rather than an obviously local
  // string.
  // Minted by `skillIoIri`, the one function that owns a contract's IRI, for
  // exactly the files `layerContracts` says the schema export writes; a ref
  // it does not publish (a missing file, a collision) is left unset rather
  // than composed here.
  //
  // Only for a contract THIS layer holds. A skill held higher up names a
  // contract under its own layer's `schemas/skills/` (placement PR1, bean
  // `ybwt`), which this layer's schema export does not publish — so minting
  // an IRI under this base would name a path nothing serves, the defect the
  // published-paths test exists for.
  //
  // THAT layer publishes it, under its own `<stub>/schema/` (bean `4ak5`
  // item 1), so the edge points there: the contract's `$id` as
  // `publishedInstanceSchemas` mints it — the function the deploy writes the
  // file with, so the link and the file come from one identity (follow-up,
  // owner-approved 2026-10-05). Looked up by the ref, which is the contract's
  // source path under that layer's root, exactly as the gate matches them.
  // A layer the plan does not publish, or a contract the publisher does
  // not write or cannot give an absolute `$id`, stays unset: a guessed address
  // is worse than none.
  const own = resolve(ROOT);
  const publishedByInstance = new Map<string, Map<string, string>>();
  const publishedContract = (instanceRoot: string, ref: string): string | undefined => {
    const abs = resolve(instanceRoot);
    let ids = publishedByInstance.get(abs);
    if (ids === undefined) {
      ids = new Map();
      if (publishesInstanceSchema(abs)) {
        for (const c of publishedInstanceSchemas(abs, baseUrl).contracts) {
          if (typeof c.schema.$id === "string") ids.set(c.source.split(sep).join("/"), c.schema.$id);
        }
      }
      publishedByInstance.set(abs, ids);
    }
    return ids.get(normalize(ref).split(sep).join("/"));
  };
  // The host's published contracts, by source: `layerContracts` is the reader
  // `harness-schema-export` publishes from, so a ref has an IRI here exactly
  // when its file is written — at the root `schemas/skills/` or in a subgraph
  // (bean `cat-tools-st4q`), and keyed by skill so a move keeps the address.
  let ownPublished: Map<string, { skill: string; io: string }> | undefined;
  const contractIri = (instanceRoot: string, ref: string): string | undefined => {
    if (isExternalContract(ref)) return ref;
    if (resolve(instanceRoot) !== own) return publishedContract(instanceRoot, ref);
    ownPublished ??= new Map(layerContracts(own).contracts.map((c) => [c.source, c]));
    const hit = ownPublished.get(normalize(ref).split(sep).join("/"));
    // Under the host's own directory, where `harness-schema-export` writes it (#676).
    return hit ? skillIoIri(hostSchemaBase(base), hit.skill, hit.io) : undefined;
  };
  for (const c of skillContracts(root, scope).values()) {
    const s = get(c.skill);
    if (c.input !== undefined) s.inputSchema = contractIri(c.instanceRoot, c.input);
    if (c.output !== undefined) s.outputSchema = contractIri(c.instanceRoot, c.output);
  }

  // The skill documenting an unpublished kind is itself unpublished — it
  // carries that kind's name, and its subject is where SDLC churn goes, so
  // publishing it advertises the trashcan. Bean `folio-assistant-uv09`.
  //
  // TWO inputs, deliberately. `isPublishedSkill` matches the NAME against
  // `UNPUBLISHED_GRAPH_TYPOLOGIES`; `unpublishedSkills` reads a skill's own
  // `published: false`. Its own note asked for the second — *"if that ever
  // stops being true this needs its own list, not a cleverer derivation"* —
  // and the declaration is that list, kept with the file rather than in
  // code. They answer different questions ("is it NAMED after the trashcan",
  // "did it SAY not to publish it"), and the blanket test asserts the
  // OUTCOME over the built document at any depth, so neither can quietly
  // stop working.
  const declared = unpublishedSkills(ROOT, corpusScopeFor(ROOT));
  const publishable = (name: string): boolean => isPublishedSkill(name) && !declared.has(name);
  return [...byName.entries()]
    .filter(([name]) => publishable(name))
    .map(([name, s]) => ({
    "@id": makeIri(doc, "skill", name),
    "@type": termIri("Skill"),
    name,
    declaredName: s.fmName !== name ? s.fmName : undefined,
    title: s.title,
    description: s.description,
    // A link per package, not a bare string: the skill's package is an edge.
    // Through `packageIdFor`, so a skill's edge lands on the node its package
    // actually emits. Composing the id here independently is what let the two
    // sides agree on a name neither package had declared (bean `r1vw`).
    inPackage: s.packages.map((d) => makeIri(doc, "package", packageIdFor(d))),
    // `packagePaths` was here, repeating each package's directory beside the
    // link that already reaches it. REMOVED as denormalised: `inPackage` lands
    // on a SkillPackage node carrying `path`, every one of those links resolves
    // (0 dangling, measured 2026-09-19), and every value `packagePaths` held
    // was one of those nodes' `path`. Reading a property off a link target is
    // graph traversal; recovering a fact by SPLITTING AN IRI is the string
    // surgery this document refuses to ask of a consumer, and neither was
    // needed here.
    instructionsPath: s.instructions,
    instructionLines: s.lines,
    inputSchema: s.inputSchema,
    outputSchema: s.outputSchema,
    // The two facets, stated rather than left to be inferred from absence.
    hasInstructions: s.instructions !== undefined,
    hasIOContract: s.inputSchema !== undefined || s.outputSchema !== undefined,
    // A FLAG now, not a second copy of the package list: which packages define
    // the name is `inPackage`, and this says only that somebody has to resolve
    // it. Emitted on every skill rather than only when true, for the reason
    // `hasInstructions` is -- absence must not be the carrier of a fact.
    ambiguous: s.packages.length > 1,
  }));
}

/**
 * Registry fields that are REFERENCES, and what each one may honestly become.
 *
 * The rest of a registry file is spread verbatim, which is right for prose and
 * wrong for a name that points at another node: a bare name is dropped by a
 * JSON-LD processor when undeclared, and -- worse -- becomes a WRONG absolute
 * IRI if the term is declared `{"@type": "@id"}` without minting the value,
 * since `"git-push"` resolves against the document base. So the decision is
 * made here, per field, against what this graph actually contains:
 *
 * - **`capabilities` -> `hasCapability`, a LINK.** All 20 references resolve to
 *   a Capability node in this document (measured 2026-09-19), so the edge is
 *   real and the value is minted as that node's IRI.
 * - **`requires` on a Capability -> `requiresCapability`, a LINK.** Same test,
 *   12 of 12. It reuses the term already declared for a package's requirements
 *   rather than minting a second name for one relation. Note a TOOL's
 *   `requires` is a different relation entirely -- see `collectTools`.
 * - **`roles` -> `mayTakeRole`, a LINK (#1168 B8).** The role registry is
 *   exported now, one Role node per `scenarios/roles.json` entry, and all 73
 *   actor role references resolve (measured 2026-09-30).
 * - **`permissions` -> `permissionName`, a LITERAL.** What follows was written
 *   when roles were literals too, and still holds for permissions.
 * - (Historical) **`roles` and `permissions` -> `roleName`/`permissionName`, LITERALS.**
 *   Neither registry is in this graph: `scenarios/roles.json` and
 *   `skills/permissions/permissions.json` are never collected, and the Role
 *   nodes that do exist are BPMN lanes under different names. All 44 role and
 *   21 permission references would dangle. A name is what these are until the
 *   registries are nodes, and the term says so.
 *
 * Keyed by group, so a field a future registry adds is not silently caught by
 * a rule written for another one.
 */
function registryFields(
  group: string,
  rest: Record<string, unknown>,
  doc: string,
): Record<string, unknown> {
  const names = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  if (group === "actors") {
    const { capabilities, roles, permissions, ...other } = rest;
    return {
      ...other,
      ...(capabilities === undefined
        ? {}
        : { hasCapability: names(capabilities).map((c) => makeIri(doc, "capability", c)) }),
      ...(roles === undefined ? {} : { mayTakeRole: names(roles).map((r) => makeIri(doc, "role", r)) }),
      ...(permissions === undefined ? {} : { permissionName: names(permissions) }),
    };
  }
  if (group === "capabilities") {
    const { requires, fallbackTo, satisfies, setupSkill, ...other } = rest;
    return {
      ...other,
      // Not `satisfies`: that term is a LINK to a skill, and a Tool's. A
      // capability discharges a requirement STATEMENT, which this graph does
      // not hold as a node, so the ref stays a name (#1168, B3).
      ...(satisfies === undefined ? {} : { satisfiesStatement: names(satisfies) }),
      ...(requires === undefined
        ? {}
        : { requiresCapability: names(requires).map((c) => makeIri(doc, "capability", c)) }),
      // Renamed on the way out, like `requires` above: `fallbackTo` is a
      // fine field name on a Capability and an ambiguous TERM in a shared
      // vocabulary, where a Tool and a Role could each want one.
      ...(typeof fallbackTo === "string"
        ? { fallbackToCapability: makeIri(doc, "capability", fallbackTo) }
        : {}),
      // A LINK to the skill node, the same IRI a skill is exported under
      // (bean rqao): the setup procedure for this capability.
      ...(typeof setupSkill === "string" ? { setupBySkill: makeIri(doc, "skill", setupSkill) } : {}),
    };
  }
  return rest;
}

function collectRegistryNodes(doc: string, problems: string[]): Node[] {
  const nodes: Node[] = [];
  // What an actor may do lives in the ODRL policies since issue #1180, not on
  // the actor file. Restored here so `permissionName` still says what it held.
  // declared-path-literal: the convention home of the policies graph typology,
  // resolved beside the actor registry this function already reads by path.
  const grants = readPolicyGrants(join(ROOT, "policies"));
  for (const [group, type] of Object.entries(REGISTRY_GROUPS)) {
    // Actors resolve from their DECLARED home inside `scenarios` (bean rqao).
    // This read `.claude/skills/actors` and skipped it when absent, so the move
    // exported ZERO actors while the run looked clean — a silent skip is
    // `dh4f`, so a missing actor registry is now a problem, not a `continue`.
    // The other registry groups are still where they were.
    const abs =
      group === "actors"
        ? actorsDir(repoRootFor(ROOT))
        : group === "capabilities"
          ? capabilitiesDir(repoRootFor(ROOT))
          : join(repoRootFor(ROOT), ".claude", "skills", group);
    if (abs === undefined || !existsSync(abs)) {
      if (group === "actors" || group === "capabilities") {
        problems.push(`the ${group} registry has no home: ${abs ?? "no declared scenarios graph"}`);
      }
      continue;
    }
    for (const f of readdirSync(abs)) {
      if (!f.endsWith(".json")) continue;
      try {
        const d = JSON.parse(readFileSync(join(abs, f), "utf-8")) as Record<string, unknown>;
        const id = String(d.id ?? d.name ?? f.slice(0, -5));
        if (group === "actors" && d.permissions === undefined && grants.has(id)) d.permissions = grants.get(id);

        // The registry files carry `id` and `type` of their own, and spreading
        // them verbatim put BOTH a keyword and its alias on 71 nodes: `id`
        // against `@id`, `type` against `@type`. It read correctly as plain
        // JSON, which is why it survived — the document is only wrong when
        // something processes it as the JSON-LD it claims to be.
        //
        // Renamed rather than dropped. The local name and the human / agentic
        // / mechanical distinction are both real data a consumer wants, and
        // recovering `localId` by splitting the `@id` fragment is exactly the
        // string manipulation a consumer should never have to do.
        //
        // `kind` is the field since 2026-09-19; `type` is the legacy two-valued
        // one, still read so an unmigrated registry exports. Both are stripped
        // from `rest` whichever supplied the value, because leaving either in
        // reinstates the keyword collision this rename exists to fix.
        const { id: localId, kind, type: legacyType, ...rest } = d;
        const actorKind = kind ?? legacyType;
        nodes.push({
          "@id": makeIri(doc, type.toLowerCase(), id),
          "@type": termIri(type),
          ...(localId === undefined ? {} : { localId: String(localId) }),
          ...(actorKind === undefined ? {} : { actorKind: String(actorKind) }),
          ...registryFields(group, rest, doc),
        });
      } catch (e) {
        problems.push(`unparseable ${group}/${f}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return nodes;
}

/**
 * A package's id — from its MANIFEST's `name`, not from its directory.
 *
 * ## The collision this replaces, measured 2026-09-20 (bean `r1vw`)
 *
 * The id was `dir.split("/").pop()`, and eleven of the twelve packages here
 * hid that, because their directory is named after the package. The twelfth
 * is `bootstrap/skills/`, whose manifest declares `"name": "bootstrap"`
 * and whose node was `package/skills`, **named `skills`** — the manifest's own
 * name was never read.
 *
 * `cat-harness/src/skills/` has the same basename. Both wanted `package/skills`,
 * and the `seen` set below silently dropped whichever came second while its
 * skills kept emitting `inPackage -> package/skills`. So `corpus-grep`, a
 * cat-harness skill in a directory with no manifest at all, was published as a
 * member of bootstrap's package. Nothing reported it: both sides resolved,
 * no link dangled, and the audit's `skill-servable` criterion was SATISFIED by
 * the collision — a skill served by a package it was never listed in.
 *
 * An id derived from a path is an id two paths can agree on by accident. Read
 * from the declaration and the accident needs two authors to choose one name.
 *
 * The basename remains the fallback, and that is not a hedge: `src/skills/` and
 * `.claude/skills/local` carry no manifest, and a package with no declared name
 * has nothing else to be called. What changes is that the name is only INFERRED
 * where nothing was declared.
 */
function packageIdFor(dirRelToRoot: string): string {
  const leaf = dirRelToRoot.split("/").pop()!;
  const mf = join(ROOT, dirRelToRoot, "package-manifest.json");
  if (!existsSync(mf)) return leaf;
  try {
    const name = (JSON.parse(readFileSync(mf, "utf-8")) as { name?: unknown }).name;
    return typeof name === "string" && name.length > 0 ? name : leaf;
  } catch {
    // An unparseable manifest is reported by `collectPackages` below, which
    // reads the same file. Falling back here keeps one defect from becoming
    // two: the package still gets a node, under the only name left.
    return leaf;
  }
}

function collectPackages(doc: string, problems: string[], scope: CorpusScope = corpusScopeFor(ROOT)): Node[] {
  const nodes: Node[] = [];

  // Every directory that holds skills is a package node, manifest or not.
  // `src/skills` and `.claude/skills/local` carry no `package-manifest.json`,
  // and skipping them left 9 `inPackage` links pointing at nodes that were
  // never emitted — a dangling link in a published graph, which is the defect
  // this export exists to make visible rather than to commit.
  // Which directory claimed each id, so a second claimant can be NAMED rather
  // than dropped. `seen` was a bare Set of basenames and its `continue` was
  // the whole bug: two directories wanting one id was indistinguishable from
  // the same directory seen twice.
  const claimedBy = new Map<string, string>();
  for (const dir of skillMdDirs(ROOT, scope)) {
    if (!existsSync(join(ROOT, dir))) continue;
    const id = packageIdFor(dir);
    const prior = claimedBy.get(id);
    if (prior !== undefined) {
      // NOT a silent skip. One node is still emitted — dropping it would
      // dangle every `inPackage` edge pointing at it — but the graph no
      // longer pretends the second directory does not exist.
      if (prior !== dir) {
        problems.push(
          `two skill directories claim package id "${id}": ${prior} and ${dir}. ` +
            `A package's id comes from its manifest's \`name\`, or from its directory ` +
            `basename when it declares none — so give one of them a manifest that ` +
            `names it, rather than letting both resolve to the same node.`,
        );
      }
      continue;
    }
    claimedBy.set(id, dir);
    nodes.push({
      "@id": makeIri(doc, "package", id),
      "@type": termIri("SkillPackage"),
      name: id,
      path: dir,
      hasManifest: existsSync(join(ROOT, dir, "package-manifest.json")),
    });
  }

  const skillsRoot = join(ROOT, "skills");
  // Hoisted: `unpublishedSkills` walks every declared skill directory, so
  // calling it inside the filter below would re-read the corpus once per
  // package entry.
  const declaredUnpublished = unpublishedSkills(ROOT, corpusScopeFor(ROOT));
  if (!existsSync(skillsRoot)) return nodes;
  for (const d of packageDirsIn(skillsRoot)) {
    const mf = join(d.dir, "package-manifest.json");
    if (!existsSync(mf)) continue;
    try {
      const m = JSON.parse(readFileSync(mf, "utf-8")) as Record<string, unknown>;
      // The SAME id the stub loop minted — from the manifest's `name`, via the
      // one resolver. Composing `d.name` here was harmless only because every
      // package under `skills/` happens to sit in a directory of its own name;
      // the moment one does not, this pushed a second node beside the stub
      // instead of replacing it (bean `r1vw`).
      const id = packageIdFor(`skills/${d.rel}`);
      const iri = makeIri(doc, "package", id);
      // Replace the stub emitted above with the manifest-backed node.
      const stubAt = nodes.findIndex((n) => n["@id"] === iri);
      if (stubAt !== -1) nodes.splice(stubAt, 1);
      nodes.push({
        "@id": iri,
        "@type": termIri("SkillPackage"),
        name: m.name ?? d.name,
        version: m.version,
        description: m.description,
        path: `skills/${d.rel}`,
        hasManifest: true,
        // Links, so a consumer can walk package → skill without string surgery.
        // Filtered too: an edge to a stripped node is a dangling reference
        // that still spells the name it was meant to remove.
        declaresSkill: ((m.skills as string[]) ?? [])
          .filter((n) => isPublishedSkill(n) && !declaredUnpublished.has(n))
          .map((n) => makeIri(doc, "skill", n)),
        providesCapability: ((m.providesCapabilities as string[]) ?? []).map((c) => makeIri(doc, "capability", c)),
        requiresCapability: ((m.requiresCapabilities as string[]) ?? []).map((c) => makeIri(doc, "capability", c)),
      });
    } catch (e) {
      problems.push(`unparseable manifest skills/${d.rel}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return nodes;
}


/**
 * Stamp every node with the DECLARED DIRECTORY it came from.
 *
 * The owner, 2026-09-20, on the KG viewer: *"should show hierarchy of named
 * subgraphs in the harness instance(s) ... I should see ability to filter by
 * bootstrap/ cat-harness/ f-a-core/ f-a/ etc."* A reader cannot filter by
 * something no node says, and until now no node said it: a skill carried
 * `instructionsPath`, a schema carried `module`, and which *declared graph*
 * either belonged to had to be re-derived by whoever looked.
 *
 * ## Derived from the declaration, in one pass, rather than threaded
 *
 * Every emitter could have been given the id. That is nine call sites to keep
 * in step, and the tenth emitter added next week is the one that forgets —
 * which is the shape this repository keeps paying for. Here the mapping is
 * computed ONCE from `declaredGraphs()`, so a directory that moves takes its
 * stamp with it and a directory that is added is covered without touching this
 * function.
 *
 * ## Longest prefix wins, and that is load-bearing
 *
 * `src/skills/` sits inside `src/`, and `processes/` inside `skills/`.
 * Matching the first declaration that fits would file a workflow under the
 * skills graph. Sorting by descending path length makes the most specific
 * declaration win, which is the same rule a router uses and the same one
 * `resolveDirectories` relies on for overrides.
 *
 * A node whose path matches no declared directory is left UNSTAMPED rather
 * than bucketed into a default — "could not determine" is a distinct answer
 * from "belongs to the root graph", and the viewer shows it as its own facet
 * so the gap is visible instead of absorbed.
 */
function stampSubgraph(graph: Node[], doc: string, instanceRoot: string = ROOT): void {
  // THE LAYER BEING EXPORTED, not the module-level `ROOT`.
  //
  // It read `ROOT` on both lines until 2026-09-21, so exporting ANOTHER
  // layer stamped its nodes with THIS layer's directory ids wherever the
  // two share a relative path. `bootstrap/scenarios/` and
  // `cat-harness/scenarios/` are both `scenarios`, so bootstrap's
  // own directory node came out carrying `inSubgraph ->
  // bootstrap.jsonld#directory/cat-harness-roles` — an id from the other
  // layer, in a document that does not define it, which the dangling-link
  // check caught as soon as the second `scenarios/` was declared.
  //
  // One layer's graph must not carry another's nodes
  // (`instance-graph-isolation.test.ts`, guarding a live leak of 88
  // references). This is that rule in the facet that says WHICH SUBGRAPH a
  // node came from — the one place where getting the root wrong produces a
  // plausible id rather than a missing one.
  const dirs = declaredGraphs(instanceRoot)
    .filter((d) => d.absPath !== undefined)
    .map((d) => ({ id: d.id, rel: relative(instanceRoot, d.absPath!).replace(/\\/g, "/").replace(/\/$/, "") }))
    // `..` is KEPT, and dropping it is what made this facet useless.
    //
    // Every repository-scoped entry — a content layer's directory,
    // `bootstrap/`, `detangle/`, `large-datasets/` —
    // resolves to `../<instance>/…` relative to this layer, so
    // `!startsWith("..")` excluded the entire set the facet exists to offer.
    //
    // MEASURED after the fact, which is the part worth recording: the facet
    // rendered, was screenshotted, and was reported as working, while its
    // values were `cat-harness` (1,267 nodes) and a handful of this layer's
    // own directories. Not one sibling layer appeared. The owner had asked
    // to "filter by bootstrap/ cat-harness/ f-a-core/ etc"; the thing shipped
    // could not.
    //
    // A path that leaves the layer is still a path this graph carries —
    // `schema-nodes.ts` mints `../<content-core>/schemas/…` — so the
    // comparison below matches in the same space rather than excluding it.
    .filter((d) => d.rel.length > 0)
    .sort((a, b) => b.rel.length - a.rel.length);

  const PATH_KEYS = ["instructionsPath", "module", "sourcePath", "path"] as const;
  for (const n of graph) {
    let p: string | undefined;
    for (const k of PATH_KEYS) {
      const v = n[k];
      if (typeof v === "string" && v.length > 0) { p = v.replace(/\\/g, "/"); break; }
    }
    if (p === undefined) continue;
    const hit = dirs.find((d) => p === d.rel || p!.startsWith(d.rel + "/"));
    if (hit) n.inSubgraph = subgraphIri(doc, hit.id);
  }

  // INHERIT through `partOf`, for the nodes that have no path of their own.
  //
  // A Process carries `sourcePath`; the 1,092 ProcessNodes and SequenceFlows
  // inside it do not — they are parts of a diagram, not files. Measured before
  // this loop: 301 of 1,642 nodes stamped, and the 1,341 left were almost all
  // process internals whose subgraph is simply their parent's.
  //
  // Iterated to a fixed point rather than done once, because `partOf` nests
  // (a flow belongs to a process which belongs to a package), and a single
  // pass would stamp only the first level. It terminates: every pass either
  // stamps at least one node or stops.
  const byIri = new Map(graph.map((n) => [String(n["@id"]), n]));
  for (;;) {
    let stamped = 0;
    for (const n of graph) {
      if (n.inSubgraph !== undefined) continue;
      const parent = n.partOf;
      const parentIri = Array.isArray(parent) ? parent[0] : parent;
      if (typeof parentIri !== "string") continue;
      const sub = byIri.get(parentIri)?.inSubgraph;
      if (typeof sub === "string") { n.inSubgraph = sub; stamped += 1; }
    }
    if (stamped === 0) break;
  }
}

async function collectProcesses(
  doc: string,
  problems: string[],
  root: string = ROOT,
  /**
   * Determined empties. SEPARATE from `problems` because they are different
   * facts with different consequences: a problem means this layer's graph
   * could not be exported correctly, a note means it was exported correctly
   * and something it might have had, it has none of.
   *
   * Optional so the two existing callers keep compiling; a caller that does
   * not pass one still gets the finding, in `problems`, which is the old
   * behaviour and the safe default for a sink nobody is reading.
   */
  notes?: string[],
  /**
   * The base of the SITE that serves this layer's pictures, when the
   * caller has one. With it, a Process whose diagram `render:bpmn` has drawn
   * into that site carries the SVG as `depiction`; without it (a fixture, a
   * layer outside this repository) the link is simply absent, never
   * composed against a base nobody declared.
   */
  base?: string,
  /** Whose directories are read — see {@link ExportOptions.scope}. */
  scope: CorpusScope = corpusScopeFor(root),
  /**
   * The publication base. With it, a lane's role and a step's skill that
   * ANOTHER layer declares link into that layer's document ({@link roleHome},
   * {@link skillHome}); without it (a fixture) every link stays in `doc`.
   */
  pubBase?: string,
): Promise<Node[]> {
  const nodes: Node[] = [];
  const dirs = findBpmnDirs(root, scope);
  // Where a diagram can be read on its forge, from the REPOSITORY's own
  // declaration (`repository: owner/name`) — never from the checkout's
  // remote, which differs by clone and would make the committed subgraph
  // files differ with it. A file in a submodule resolves to the submodule's
  // repository.
  // The CHECKOUT, not `dirname`: for the root layer `dirname` is outside it (g43f).
  const repoRoot = checkoutRootFor(root);
  // An index checkout's root declares no layer (owner, 2026-10-08), so it
  // names no repository; then the layer's own declaration does. Every file
  // of a remote-mounted layer resolves to the mount's repository through
  // `forgeLocation` anyway, so this only supplies the fallback that call
  // needs — without it every `sourceUrl` in the separated index vanished.
  const repositoryOf = (dir: string): string | undefined => {
    try {
      return readDeclaration(dir)?.repository;
    } catch {
      return undefined;
    }
  };
  const repoName = repositoryOf(repoRoot) ?? repositoryOf(root);
  const forgeOf = (abs: string): string | undefined => {
    if (!repoName) return undefined;
    const at = forgeLocation(relative(repoRoot, abs).split(sep).join("/"), `https://github.com/${repoName}`, repoRoot);
    return `${at.repoUrl.replace(/\.git$/, "")}/blob/main/${at.path.split("/").map(encodeURIComponent).join("/")}`;
  };
  // `render:bpmn` draws every diagram in the checkout into THIS layer's
  // site, the one the deploy serves. It was asked only of this layer's
  // export while that export carried every stacked layer's processes;
  // since the split (bean `4ak5` item 2) those are in their owners'
  // documents, which pass this site's base so their pictures stay linked —
  // 25 diagrams' worth on the workflow page.
  const svgDir = base !== undefined ? join(ROOT, siteDirFor(ROOT), "assets", "img", "workflows") : undefined;
  const depictionOf = (abs: string): string | undefined => {
    if (svgDir === undefined) return undefined;
    const name = `${basename(abs, ".bpmn")}.svg`;
    // The site copy is built at publish (cat-harness#1047); the drawing
    // committed beside the .bpmn (bean akiq) says the same diagram is drawn.
    const drawn = existsSync(join(svgDir, name)) || existsSync(abs.replace(/\.bpmn$/, ".svg"));
    return drawn ? `${base!.replace(/\/+$/, "")}/assets/img/workflows/${name}` : undefined;
  };
  // Zero diagrams is a determined empty ONLY if we looked. Say which.
  //
  // AND A LAYER THAT DECLARES NO `kg` DIRECTORY HAS NOTHING TO LOOK IN.
  // `workflowDirs` searches the layer's declared `kg` directories, so for
  // a layer declaring none it returns `[]` for a reason that is not
  // "nothing was found" but "there was nowhere to look, by the instance's own
  // declaration". Reporting the first as the second turned a determined empty
  // into a FAILURE: measured 2026-09-20, the repository root — which declares
  // `uploads/` and nothing else — failed `check:instance-render` on this
  // message alone, with 1 node of its own rendered and published and no other
  // complaint. A gate that fails a layer for not having a kind of graph it
  // never claimed is asking it to declare something to stay green, which is
  // how a declaration stops meaning anything.
  //
  // REPO-RELATIVE, not absolute: this string is written into a PUBLISHED
  // artefact, and an absolute path differs between a developer's machine and
  // CI — so it would leak a runner's filesystem layout into a public document
  // and change on every build.
  //
  // It said "a COMMITTED artefact (`bootstrap/bootstrap.jsonld`) ... so its
  // staleness gate would fail on a tree nobody touched". **That file is not
  // committed and has no staleness gate.** `.gitignore:108` ignores it
  // deliberately — it was committed once, on a rationale citing a README step
  // that no prose file under `bootstrap/` actually contains, and it was 52 %
  // of `bootstrap/` by line count. `docs-site.yml:274` builds it into
  // `_site/bootstrap/bootstrap.jsonld` at render time instead.
  //
  // The CHOICE was right and its stated reason was not, which is the worse
  // failure of the two: a reader checking the claim finds no gate, concludes
  // the constraint is imaginary, and makes the path absolute. The real reason
  // is above, and it does not depend on where the file is stored.
  //
  // A DECLARED DIRECTORY HOLDING NO DIAGRAMS IS A NOTE, NOT A PROBLEM, and
  // until 2026-09-20 it was a problem. It has to be SAID either way —
  // `instance-graph-isolation.test.ts` puts it exactly right, "it says it
  // found none, rather than passing over in silence" — but saying it and
  // FAILING the layer for it are different things, and only the first was
  // ever wanted. Three layers arrived at once (`kg-navigation`,
  // `large-datasets`, a library replica), each holding one skill and no workflow,
  // each rendering its nodes, each failed on this message alone. A skills
  // package with no process is an ordinary thing; requiring a diagram to stay
  // green is asking a layer to carry something it never claimed.
  //
  // AND THE SAME DISTINCTION ONE LEVEL DOWN, which is what this asked for
  // until 2026-09-20: a declared `kg` directory that HOLDS NO DIAGRAMS is a
  // determined empty, not a failure. The condition above read
  // `dirs.length === 0 && kgDirectories(root).length > 0` — "declares a
  // knowledge graph and no .bpmn was found" — which is only a defect if
  // declaring a knowledge graph meant declaring PROCESSES. It does not. A
  // layer declaring `skills/` claims skills; a skills package with no
  // workflow is an ordinary thing and three arrived at once
  // (`kg-navigation`, `large-datasets`, a library replica), each holding one skill,
  // each rendering its nodes, each failed on this message alone.
  //
  // That is the same shape the paragraph above rejects, one level in: asking
  // a layer to carry a diagram it never claimed in order to stay green.
  // The `dh4f` case it was reaching for — a declared directory nothing scans
  // — is real and is caught by the ABSENCE check, which now runs over the
  // DECLARED directories rather than only over the ones already known to hold
  // a diagram. Before this it could not fire for a diagramless directory at
  // all: `findBpmnDirs` never returned one, so the loop below never saw it.
  // NOT `kgDirectories`, and that distinction is the whole check.
  //
  // `kgDirectories` ends with `.filter((d) => existsSync(d.absPath))`, so an
  // absent directory is gone from its result and an absence check written
  // over it can never fire. I wrote exactly that first, and it reported a
  // clean run while `kg-navigation/skills/` was moved out from under it —
  // a vacuous guard offered as the replacement for the one being removed,
  // which is worse than removing it with nothing in its place.
  //
  // Reading the DECLARATION is the only way to compare what was claimed
  // against what is there, because the filtered view has already thrown the
  // discrepancy away.
  if (dirs.length === 0 && kgDirectories(root, scope).length > 0) {
    (notes ?? problems).push(
      `no directory containing .bpmn files was found under ${relative(ROOT, root) || "."}`,
    );
  }

  // NOT `kgDirectories`, and that distinction is the whole check.
  //
  // `kgDirectories` ends with `.filter((d) => existsSync(d.absPath))`, so an
  // absent directory is gone from its result and an absence check written
  // over it can never fire. I wrote exactly that first, and it reported a
  // clean run while `kg-navigation/skills/` was moved out from under it —
  // a vacuous guard offered as the replacement for the one being softened,
  // which is worse than softening it with nothing in its place.
  //
  // Reading the DECLARATION is the only way to compare what was claimed
  // against what is there, because the filtered view has already thrown the
  // discrepancy away. This is the `dh4f` case the old condition was reaching
  // for and could not reach: before this, a declared-but-absent directory and
  // a declared-but-diagramless one produced the SAME message, so the test
  // named "a declared-but-ABSENT directory is reported" passed while its
  // fixture created the directory.
  for (const d of resolveDirectories([{ name: "(local)", root, own: true }])) {
    // All four spellings of "this is harness knowledge-graph content": the
    // umbrella, plus the three kinds split out of it on 2026-09-21. Testing
    // only the umbrella here would have quietly narrowed this sweep to the
    // mixed `["schemas","cat-harness"]` entries the moment the split landed —
    // a declared-but-absent skills directory would have stopped being
    // reported, which is the `dh4f` shape this very loop exists to catch.
    if (!d.graphTypologies.some((k) => KG_CONTENT_GRAPH_TYPOLOGIES.includes(k))) continue;
    if (!existsSync(d.absPath)) {
      problems.push(`declared knowledge-graph directory is absent: ${d.path}`);
    }
  }
  // EACH DMN DECISION IS A NODE. Owner, 2026-09-27: add each DMN decision
  // table to the knowledge graph as its own node, linked to the BPMN gateway
  // that uses it and to the DMN 1.3 standard. Before this a gateway carried
  // only `decisionRef`, a path-and-fragment string, so the rule that computes
  // a branch was the one thing about the branch a reader could not walk to.
  //
  // Keyed by the RESOLVED file path plus the decision id, which is exactly
  // how `loadDecisions` in `process-model.ts` resolves a gateway's ref — so a
  // `decidedBy` link is written only when the table it names was emitted
  // here, and a ref to a file or id nobody declares stays a literal rather
  // than becoming a dangling link. Collected per workflow directory, BEFORE
  // its diagrams, so both export paths (this layer's and a foreign one's,
  // via `collectInstanceNodes`) get the same guarantee from the same code.
  const decisionIri = new Map<string, string>();
  const decisionOwner = new Map<string, string>();
  const collectDecisions = async (dir: string): Promise<void> => {
    for (const dmn of diagramFiles(dir).filter((f) => f.endsWith(".dmn"))) {
      try {
        for (const d of await listDecisions(dmn)) {
          const key = `${resolve(dmn)}#${d.id}`;
          if (decisionIri.has(key)) continue;
          // The IRI is `<file-stem>/<decisionId>`, readable and stable. Two
          // files with one stem in different directories would mint one IRI
          // for two tables — reported rather than silently merged.
          const iri = makeIri(doc, "decision", `${basename(dmn, ".dmn")}/${d.id}`);
          const prior = decisionOwner.get(iri);
          if (prior !== undefined && prior !== key) {
            problems.push(`decision IRI collision: ${relative(root, dmn)}#${d.id} and ${prior}`);
            continue;
          }
          decisionOwner.set(iri, key);
          decisionIri.set(key, iri);
          nodes.push({
            "@id": iri,
            "@type": termIri("Decision"),
            name: d.name,
            hitPolicy: d.hitPolicy,
            sourcePath: relative(root, dmn),
            // `conformsTo` → DMN 1.3 is written by `linkSchemas`, from the
            // file's own namespace, and only when that node is in the graph.
          });
        }
      } catch (e) {
        problems.push(`unloadable decision table ${relative(root, dmn)}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };
  const decidedBy = (bpmnPath: string, ref: string | undefined): string | undefined => {
    if (!ref) return undefined;
    const [file, id] = ref.split("#");
    if (!file || !id) return undefined;
    return decisionIri.get(`${resolve(dirname(bpmnPath), file)}#${id}`);
  };

  for (const rel of dirs) {
  const dir = join(root, rel);
  // A directory that was found and then vanished, or one a declaration names
  // and the tree does not carry, is a FINDING rather than a crash — and
  // rather than a silent skip, which is the `dh4f` shape.
  if (!existsSync(dir)) {
    problems.push(`declared workflow directory is absent: ${rel}`);
    continue;
  }
  await collectDecisions(dir);
  // At any depth: since placement PR3 (bean `63wl`) the diagrams sit in
  // `processes/<group>/`, and a top-level read exported none of them.
  for (const path of diagramFiles(dir)) {
    if (!path.endsWith(".bpmn")) continue;
    try {
      // A layer's shared global-tasks file holds no process (owner,
      // 2026-10-20, "a1"): each global task is a Task node that requires its
      // Skill, and each call to one links to it as its `calledElement`.
      if (isGlobalTasksFile(readFileSync(path, "utf-8"))) {
        for (const g of await loadGlobalTasks(path)) {
          nodes.push({
            "@id": makeIri(doc, "globalTask", g.id),
            "@type": termIri("Task"),
            name: g.name,
            ...publishableDocumentation(g.documentation),
            bpmnType: g.type,
            requires: g.skills.map((k) => makeIri(pubBase === undefined ? doc : skillHome(pubBase, doc, k, scope, root), "skill", k)),
            sourcePath: relative(root, g.source),
            sourceUrl: forgeOf(g.source),
          });
        }
        continue;
      }
      const m = await loadProcessModel(path);
      nodes.push({
        "@id": makeIri(doc, "process", m.id),
        "@type": termIri("Process"),
        name: m.name,
        // The diagram's OWN `bpmn:documentation` — what the process is FOR —
        // whole as `description` and its first sentence as `summary`, the two
        // naming keys every other node already uses (bean `ax6r`). The
        // workflow page's row text is this, so a sentence about a process is
        // written once, in the process.
        //
        // A text that NAMES an unpublished graph typology is not carried — the
        // owner's 2026-09-19 rule that references to `fsh-guts` are stripped
        // before publication covers prose as much as edges. The first
        // sentence is kept when it alone is clean, so the row still says what
        // the process is for (`sample-import` is the live case).
        ...publishableDocumentation(m.documentation),
        enforcement: m.enforcement,
        sourcePath: relative(root, m.source),
        sourceUrl: forgeOf(m.source),
        depiction: depictionOf(m.source),
        startNode: m.startNodes.map((n) => makeIri(doc, "process", `${m.id}/node/${n}`)),
        nodeCount: m.nodes.size,
        flowCount: m.flows.size,
      });
      for (const f of m.flows.values()) {
        // Sequence flows are nodes too. `incoming`/`outgoing` already pointed
        // at them, so omitting them left 60-odd links dangling — a link minted
        // for an element the exporter declined to emit.
        nodes.push({
          "@id": makeIri(doc, "process", `${m.id}/flow/${f.id}`),
          "@type": termIri("SequenceFlow"),
          name: f.name,
          partOf: makeIri(doc, "process", m.id),
          from: makeIri(doc, "process", `${m.id}/node/${f.from}`),
          to: makeIri(doc, "process", `${m.id}/node/${f.to}`),
        });
      }
      // A lane is its OWN node, part of its process, binding a role (#1168,
      // B9b; owner 2026-09-30: "Lane node"). Until then a lane was minted as a
      // Role keyed by its NAME, so one role had two nodes — `role/<lane name>`
      // and the registry's `role/<id>` — joined only by `bindsRole`, and a lane
      // whose name happened to equal a role id silently merged into it.
      //
      // Read from the DECLARED lane set, not from the lanes flow nodes happen
      // to name. A lane that holds no activities is still a lane that names a
      // role, so deriving lanes from node references would drop it.
      for (const lane of m.lanes) {
        nodes.push({
          "@id": makeIri(doc, "process", `${m.id}/lane/${lane.id}`),
          "@type": termIri("Lane"),
          name: lane.name ?? lane.id,
          partOf: makeIri(doc, "process", m.id),
          bindsRole: lane.roleRef === undefined ? undefined : makeIri(roleHome(pubBase, doc, lane.roleRef, root, scope), "role", lane.roleRef),
        });
      }
      for (const n of m.nodes.values()) {
        nodes.push({
          "@id": makeIri(doc, "process", `${m.id}/node/${n.id}`),
          "@type": termIri("ProcessNode"),
          name: n.name,
          nodeKind: n.kind,
          bpmnType: n.type,
          partOf: makeIri(doc, "process", m.id),
          // The edges nothing else surfaces — now genuine links.
          //
          // `laneName` and `implementsSkillNames` sat beside these two,
          // repeating each target's name as a string. REMOVED as denormalised:
          // the Lane node carries the lane name as its `name`, every named
          // skill has a Skill node carrying its own. A name duplicated beside
          // a link is a second answer that can go stale.
          //
          // `performedBy` reaches the REGISTRY role through the lane's
          // `roleRef` (#1168, B9b): the role that performs, not the lane it
          // performs in. `inLane` is the lane.
          performedBy: n.roleRef === undefined ? undefined : makeIri(roleHome(pubBase, doc, n.roleRef, root, scope), "role", n.roleRef),
          inLane: n.laneId === undefined ? undefined : makeIri(doc, "process", `${m.id}/lane/${n.laneId}`),
          // `requires` (dcterms), was `implementedBy` — see `buildContext`.
          requires: n.skills.map((k) => makeIri(pubBase === undefined ? doc : skillHome(pubBase, doc, k, scope, root), "skill", k)),
          touchesWorkPlan: n.touchesWorkPlan,
          workPlanOp: n.workPlanOp,
          relaxable: n.relaxable,
          decisionRef: n.decisionRef,
          // The same ref as a LINK to the Decision node, written only when
          // that node was emitted above (owner, 2026-09-27). `decisionRef`
          // stays beside it as the literal as authored: removing it would
          // move a published term, and it is what a reader needs when the
          // link is absent because the table was not found.
          decidedBy: decidedBy(m.source, n.decisionRef),
          // Pruned below when the called process is not in this graph.
          calledElement:
            n.globalTask !== undefined
              ? makeIri(doc, "globalTask", n.globalTask.id)
              : n.calledElement === undefined
                ? undefined
                : makeIri(doc, "process", n.calledElement),
          incoming: n.incoming.map((f) => makeIri(doc, "process", `${m.id}/flow/${f}`)),
          outgoing: n.outgoing.map((f) => makeIri(doc, "process", `${m.id}/flow/${f}`)),
        });
      }
    } catch (e) {
      problems.push(`unloadable process ${relative(root, path)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  }
  // A call to a process this graph does not hold stays out of it rather than
  // becoming a dangling link — `Process_MergeRefusal`, called and defined
  // nowhere, is the live case. Resolved after every diagram is read, because a
  // call may name a process in a file read later.
  const processIris = new Set(nodes.filter((n) => n["@type"] === termIri("Process") || n["@type"] === termIri("Task")).map((n) => n["@id"]));
  for (const n of nodes) {
    if (typeof n.calledElement === "string" && !processIris.has(n.calledElement)) delete (n as Record<string, unknown>).calledElement;
  }
  return nodes;
}

/** `summary` and `description` from a diagram's documentation, minus any text naming an unpublished graph typology. */
function publishableDocumentation(doc: string | undefined): { summary?: string; description?: string } {
  if (!doc) return {};
  const clean = (t: string): boolean => !UNPUBLISHED_GRAPH_TYPOLOGIES.some((k) => t.includes(k));
  const summary = firstSentence(doc);
  return { ...(clean(summary) ? { summary } : {}), ...(clean(doc) ? { description: doc } : {}) };
}

/** The first sentence of a longer text — a node's `summary` when only a body is authored. */
export function firstSentence(s: string, max = 260): string {
  const one = s.replace(/\s+/g, " ").trim();
  const stop = one.search(/\.\s|\.$/);
  const cut = stop > 0 ? one.slice(0, stop + 1) : one;
  return cut.length > max ? cut.slice(0, max - 1).trimEnd() + "…" : cut;
}

/**
 * The graph typologies themselves, as nodes.
 *
 * This is the self-describing half. `holdsGraph` on a directory points at a
 * kind, and without these the vocabulary a reader needs in order to interpret
 * the document lives only in TypeScript they cannot fetch. With them, the
 * published graph carries its own terms: follow `holdsGraph` and you arrive at
 * a node saying what that kind holds and whether it renders.
 *
 * Note this imports `folio-graph-typology`, so the export sees the kind
 * `folio-assist-core` registers and not just the harness's four. It takes no
 * document IRI because these nodes are minted under the NAMESPACE: a graph
 * kind means the same thing in a preview and in the canonical graph, so its
 * IRI must not vary with where the document is published.
 */
/**
 * Tool nodes — the `tools` graph.
 *
 * `satisfies` is emitted as LINKS to skill nodes, which is the edge the whole
 * skill/Tool separation exists to express: a reader can now walk from "claim
 * the item before you work" to the two mechanisms that do it, without knowing
 * that a bare string was meant to be a skill name.
 */
/**
 * The document IRI a skill's node lives in — this one, or a sibling's.
 *
 * ## Why a Tool may name a skill this document does not contain
 *
 * `gn4l`: the Tool nodes for `discussion` and `log-message` live in
 * cat-harness because a Tool is cat-harness's vocabulary and bootstrap may
 * not import it — recorded there as *a limitation rather than a decision*,
 * with the nodes moving unchanged once tool collection stops being
 * import-bound. The SKILLS live in bootstrap so a Bootstrapping Agent can read them
 * with nothing installed. So the edge crosses layers by construction.
 *
 * While cat-harness declared `bootstrap/skills/` the crossing was hidden:
 * both ends landed in one document. The owner's `pve3` ruling of 2026-09-21
 * ("neither") removed that declaration, and a link minted into THIS document
 * then pointed at a node no document contains.
 *
 * ## An unknown skill still gets THIS document's IRI
 *
 * Deliberately. A skill nothing declares is a genuine dangling link and must
 * keep reading as one — inventing a plausible foreign IRI for it would turn a
 * reported defect into a link that merely 404s later, which is the harder
 * failure to find. Only a skill some layer DOES declare is re-homed.
 */
/** One answer per skill per build: roles and Tools ask about the same names many times. */
const skillHomes = new Map<string, string>();

/**
 * `ownRoot` is the layer whose document `ownDoc` IS. It was always `ROOT`
 * until layer exports began collecting Tools (bean `tdir`): a DAK base
 * layer's `extract-dak` satisfies a skill that layer declares, and asking cat-harness
 * "do you have it?" first would either keep a cat-harness-only skill in
 * that layer's document (a dangling link) or send its own skill to a
 * sibling's. So the "this document wins" test asks the layer being
 * exported, and every OTHER layer, the host included, is a sibling.
 */
function skillHome(
  base: string,
  ownDoc: string,
  skillId: string,
  scope: CorpusScope = corpusScopeFor(ROOT),
  ownRoot: string = ROOT,
): string {
  const key = `${base}\0${ownDoc}\0${scope}\0${resolve(ownRoot)}\0${skillId}`;
  const hit = skillHomes.get(key);
  if (hit !== undefined) return hit;
  const home = skillHomeUncached(base, ownDoc, skillId, scope, ownRoot);
  skillHomes.set(key, home);
  return home;
}

function skillHomeUncached(base: string, ownDoc: string, skillId: string, scope: CorpusScope, ownRoot: string): string {
  // THIS DOCUMENT WINS WHENEVER IT HAS THE SKILL, and that check has to come
  // first rather than fall out of iteration order.
  //
  // Without it, a skill declared by BOTH this layer and a sibling is
  // exiled to the sibling's document — the node is right here and the link
  // points elsewhere. Measured when this was written the other way round:
  // `agent-skills.jsonld` and `kg-navigation.jsonld` appeared as link targets
  // because those layers declare ids cat-harness also declares, and the
  // published-paths walk in `kg-export.test.ts` caught it as two documents
  // the deploy does not write.
  if (knownSkills(ownRoot, scope).has(skillId)) return ownDoc;
  for (const instance of layerRootsIn(repoRootFor(ROOT))) {
    if (resolve(instance) === resolve(ownRoot)) continue;
    if (!knownSkills(instance).has(skillId)) continue;
    // `publishedIdentity`, not `exportIdentity` with this base: a layer
    // that declares its own `canonicalUrl` is published under it, so passing
    // ours named `<base>/<stub>.jsonld`, a path nothing writes (bean `4ak5`).
    return publishedIdentity(instance, base || undefined).docIri;
  }
  return ownDoc;
}

/**
 * The Tool nodes of the layer at `root` — the host's when `root` is `ROOT`,
 * a sibling's when `collectInstanceNodes` asks.
 *
 * ## Why it takes the root (bean `tdir`)
 *
 * It read `toolsOf(ROOT)` and nothing called it outside the host's branch of
 * `buildExport`, so `kg-export --instance` on the DAK base layer published 0
 * of its 11 Tools and on the FHIR IG harness 0 of its 32 —
 * measured 2026-10-15, both exports otherwise complete and silent about it.
 * Discovery (`tools/discover.ts`, bean `p0za`) had already made the Tools of
 * every layer loadable; the export simply never asked for them.
 *
 * ## Two bases, and they are not the same question
 *
 * - `base` is where THIS document is published: a Tool's `maintains` and
 *   `satisfies` resolve against it, as every other node's links do.
 * - `typeBase` is where the I/O type vocabulary is published, which is the
 *   HARNESS's base for every layer (`harnessBase` in `discover.ts`).
 *   Minting a DAK base layer's port types against its canonical named
 *   `http://smart.who.int/base/tool-types/...`, a document WHO does not
 *   publish (bean `p0za`). `undefined` lets discovery use the harness's
 *   declared base; a preview passes its own `--base-url`.
 */
function collectTools(
  doc: string,
  base: string,
  problems: string[],
  scope: CorpusScope = corpusScopeFor(ROOT),
  root: string = ROOT,
  // No default: a default parameter fires on an explicit `undefined`, which
  // is exactly what a layer export passes to mean "the harness's base",
  // and it then minted smart-base's types under `http://smart.who.int/base/`.
  typeBase: string | undefined,
): Node[] {
  let defs;
  try {
    defs = toolsOf(root, typeBase);
  } catch (e) {
    problems.push(`tools/ did not load: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
  return defs.map((t) => ({
    // Its OWN document, `tools/<id>.jsonld` beside this one — not a fragment
    // of it (bean `tdir`, owner 2026-10-15: "a seperate jsonld for each Tool
    // w/ its own IRI"). `writeToolDocuments` publishes the bytes there.
    "@id": toolIri(doc, t.id),
    "@type": termIri("Tool"),
    name: t.id,
    title: t.title,
    description: t.description,
    install: t.install,
    invoke: t.invoke,
    io: t.io,
    // `requirements`, not `requires`: a Capability's `requires` names other
    // CAPABILITIES and is emitted as `requiresCapability` links, while this is
    // an environment descriptor (`{ runtime: ["go"], network: true }`) whose
    // values are not capability ids. Two relations, two terms.
    requirements: t.requires,
    // A sibling's skill is re-homed against the deploy's own base when this
    // is a layer export (`typeBase`, the `--base-url`), never against
    // this layer's canonical: `publishedIdentity` would otherwise mint a
    // sibling's document under `http://smart.who.int/base/`.
    satisfies: t.satisfies.map((k) =>
      makeIri(skillHome(root === ROOT ? base : (typeBase ?? ""), doc, k, scope, root), "skill", k),
    ),
    // `satisfiesSkillNames` was here. REMOVED as denormalised: every
    // `satisfies` link lands on a Skill node carrying that same name, and none
    // of them dangles — see {@link skillHome} for the ones that land in
    // ANOTHER layer's document, which is still a resolvable node rather
    // than a dangling link.
    // The artefacts this Tool is authoritative for, as the URLs they are
    // actually served at — `renderingPath`, not a composed string, so the
    // edge dereferences from the published document rather than looking as
    // though it might. A Tool that maintains nothing has the field absent,
    // not an empty array: `compact` drops undefined, and "maintains nothing"
    // is the normal case rather than a degenerate one worth recording.
    maintains: t.maintains?.map((m) => renderingPath(base, m.artefact)),
    // The SOURCE side of the same relation, repo-relative. Carried next to the
    // artefact because the owner's split is directional — internally the zod
    // module is definitional and the JSON-LD is downstream — and a consumer
    // that only has the graph cannot get back to the module otherwise.
    maintainsFrom: t.maintains?.map((m) => m.source),
  }));
}

/**
 * The `schemas` graph: one node per module that declares itself a schema.
 *
 * ## Why this did not exist until 2026-09-19
 *
 * `harness.json` has declared `schemas/` with `graphTypologies: ["schemas", "kg"]`
 * since Phase 0.3, and the export produced **zero** nodes of that kind —
 * measured on `814b693e`, 11 node types and none a schema. So the layer's
 * own declaration promised a graph nothing backed: a consumer resolving the
 * `schemas` kind scanned, found nothing, and had no way to tell that from a
 * layer that genuinely holds none.
 *
 * ## The membership test is the file's own declaration
 *
 * `@graphNode schema` in the leading docblock — see `scripts/schema-nodes.ts`
 * for why a JSDoc tag and not an exported constant, and why an untagged file
 * is `undeclared` rather than excluded. Nothing here infers membership from a
 * filename, which is the coincidence-not-contract defect the bean graph was
 * restructured to avoid.
 *
 * ## `maintainedBy` is the inverse of `Tool.maintains`
 *
 * Written out rather than left for a consumer to derive, on the owner's
 * standing rule that a downstream consumer must never have to string-
 * manipulate or infer a rule to follow a link. The forward direction says a
 * Tool keeps an artefact true; this says which Tool keeps THIS module's
 * artefact true, which is the question a reader of a schema node actually has.
 */
function collectSchemas(doc: string, base: string, scope: CorpusScope = "checkout", layerRoot?: string): Node[] {
  // Bean `8lcl`: the harness's schema modules live in the layer that implements
  // it, so the Schema nodes are read there; their module paths are unchanged.
  // Another layer's export (`--instance`) reads that layer's own declared
  // `schemas` graph instead, so its modules (core's `dublin-core`,
  // `catalogue`, ...) get nodes and pages of their own.
  // declared-path-literal: a probe for which layer implements the harness, not a read of the file.
  const audit = auditSchemaNodes(layerRoot ?? implementingRootFor(ROOT, "schemas/kg/cat-harness.ts"), scope);

  // Tool → artefact, inverted once so each schema node can name its keeper.
  const keeper = new Map<string, string[]>();
  try {
    for (const t of toolsOf(layerRoot ?? ROOT, base)) {
      for (const m of t.maintains ?? []) {
        keeper.set(m.source, (keeper.get(m.source) ?? []).concat(toolIri(doc, t.id)));
      }
    }
  } catch {
    // `collectTools` already records why the graph did not load; a second
    // identical problem entry would read as two failures.
  }

  return audit.nodes
    .filter((m) => isPublishedSchemaModule(m.name))
    .map((m) => ({
    "@id": makeIri(doc, "schema", m.name),
    "@type": termIri("Schema"),
    name: m.name,
    // Finding D5 (bean `lodp`), owner 2026-10-02: "Make it like the
    // others". The docblock's first line is a `summary` (rdfs:comment) as on
    // every other node type; the title is the module's stem.
    title: m.name,
    summary: m.summary,
    module: m.module,
    maintainedBy: keeper.get(m.module),
  }));
}

/**
 * The EXTERNAL SPECIFICATIONS this layer conforms to or reads, as nodes.
 *
 * `external-schemas/*.json` records each one by name and edition (BPMN 2.0,
 * DMN 1.3, ODRL, PROV-O, ...). They were a published page and not graph
 * nodes, so nothing in the graph could point at "BPMN". Owner, 2026-09-27.
 */
/**
 * One node per `.po` catalogue and `.pot` template the layer's OWN
 * `translation-sources` directory holds (owner, 2026-11-13, node-kind audit:
 * every listed node kind has an IRI, a JSON-LD document and a page). The IRI
 * is `<doc dir>/translationSource/<path under the directory>`, ending kept, so
 * `writeSubjectDocuments` serves it with its `.jsonld`; the translation-status
 * viewer draws its page and links it (`lib/translation-nodes.ts`, the one
 * reader of both). The strings stay in the file (`sourcePath`).
 */
function collectTranslationSources(doc: string, root: string = ROOT): Node[] {
  return translationNodes(root).map((t) => ({
    "@id": makeIri(doc, TRANSLATION_SUBJECT_KIND, t.id),
    "@type": termIri("TranslationSource"),
    title: t.title,
    description: t.description,
    sourceKind: "translation-sources",
    sourcePath: t.sourcePath,
  }));
}

function collectExternalSchemas(doc: string): Node[] {
  let specs: ReturnType<typeof loadSpecs>;
  try {
    specs = loadSpecs();
  } catch {
    // `external-schemas:check` reports a malformed record by name; a second
    // report here would read as two failures.
    return [];
  }
  return specs.map((sp) => ({
    "@id": makeIri(doc, "externalSchema", sp.id),
    "@type": termIri("ExternalSchema"),
    name: sp.id,
    title: sp.title,
    authority: sp.authority,
    specVersion: sp.version,
    specUse: sp.use,
    specUrl: sp.specUrl,
    namespace: sp.namespaces.length > 0 ? sp.namespaces : undefined,
  }));
}

/** The XML namespaces a file binds, `xmlns` and `xmlns:prefix` alike. */
function xmlNamespaces(path: string): string[] {
  try {
    const src = readFileSync(path, "utf-8");
    return [...src.matchAll(/xmlns(?::[a-zA-Z0-9]+)?="([^"]+)"/g)].map((m) => m[1]!);
  } catch {
    return [];
  }
}

/** Every `.bpmn` / `.dmn` under `dir`, at any depth. */
function diagramFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => f.endsWith(".bpmn") || f.endsWith(".dmn"))
    .map((f) => join(dir, f));
}

/**
 * Link graph typologies and processes to the standards and schemas behind them.
 *
 * A POST-PASS over the built graph, not a field set in each collector, for
 * one reason: a link may only be written when its target is IN this graph
 * (the foreign-instance export omits whole collectors, and a link to an
 * omitted node is the dangling-link defect). So each link is written only
 * after its target is found among the emitted nodes.
 *
 * - A `GraphTypology` `conformsTo` the specification its registry `schema` names
 *   (`external-schemas/<id>.json`), plus every specification whose namespace
 *   a diagram in one of its declared directories binds. That is how
 *   `processes` reaches DMN 1.3 as well as BPMN 2.0: the registry names one,
 *   and the decision tables under it declare the other.
 * - A `GraphTypology` `validator` links to the Schema node for its registry
 *   `validator` module; one with no node here keeps the reference as text,
 *   and `validatorNotApplicable` says why a kind has none.
 * - A `Process` or `Decision` `conformsTo` the specification its own file's
 *   namespace names.
 */
function linkSchemas(graph: Node[], root: string = ROOT): void {
  const specIri = new Map<string, string>();
  const schemaByModule = new Map<string, string>();
  for (const n of graph) {
    const t = n["@type"];
    if (t === termIri("ExternalSchema") && typeof n.name === "string") specIri.set(n.name, n["@id"] as string);
    if (t === termIri("Schema") && typeof n.module === "string") schemaByModule.set(n.module, n["@id"] as string);
  }
  if (specIri.size === 0 && schemaByModule.size === 0) return;
  let byNs = new Map<string, string>();
  try {
    byNs = new Map([...declaredNamespaces(loadSpecs())].map(([ns, sp]) => [ns, sp.id]));
  } catch { /* reported by external-schemas:check */ }
  const specsIn = (files: string[]): string[] => {
    const ids = new Set<string>();
    for (const f of files) for (const ns of xmlNamespaces(f)) {
      const id = byNs.get(ns);
      if (id && specIri.has(id)) ids.add(id);
    }
    return [...ids].sort().map((id) => specIri.get(id)!);
  };

  for (const n of graph) {
    if (n["@type"] === termIri("GraphTypology") && typeof n.name === "string") {
      const def = defaultGraphTypologies.get(n.name);
      if (!def) continue;
      const links = new Set<string>();
      const named = def.schema && /^external-schemas\/([a-z0-9.-]+)\.json$/.exec(def.schema)?.[1];
      if (named && specIri.has(named)) links.add(specIri.get(named)!);
      let dirs: string[] = [];
      try { dirs = corpusDirectoriesForGraph(root, n.name); } catch { /* undeclared: nothing to scan */ }
      for (const iri of specsIn(dirs.flatMap(diagramFiles))) links.add(iri);
      if (links.size > 0) n.conformsTo = [...links];
      if (def.validator) {
        const module = def.validator.split("#")[0]!.replace(/^[a-z0-9-]+:/, "");
        const hit = schemaByModule.get(module);
        if (hit) n.validator = hit;
        else n.validatorRef = def.validator;
      }
      if (def.validatorNotApplicable) n.validatorNotApplicable = def.validatorNotApplicable;
    }
    // A Decision reaches DMN 1.3 the same way a Process reaches BPMN 2.0:
    // from the namespace its own file binds (owner, 2026-09-27).
    if (
      (n["@type"] === termIri("Process") || n["@type"] === termIri("Decision")) &&
      typeof n.sourcePath === "string"
    ) {
      const iris = specsIn([join(root, n.sourcePath)]);
      if (iris.length > 0) n.conformsTo = iris;
    }
  }
}

/**
 * The DECLARED roles, from `scenarios/roles.json`.
 *
 * **Role nodes used to come only from BPMN lane names**, and that left the
 * role model itself out of the graph. Measured 2026-09-19: 65 of 66 Role
 * nodes carried `sourceKind: "bpmn-lane"`, so what a role IS — which actor
 * kinds may fill it, which skills it carries —
 * was nowhere in the published KG. `roles.json` is the declaration and was
 * not a source at all.
 *
 * The gap bites hardest on exactly the roles the lane heuristic cannot see.
 * A store's role whose lane carried no flow node was named by no node, so
 * it was never emitted: `corpus` and
 * `log` were both absent while `work-plan` happened to be present only
 * because some other diagram gave its lane an activity.
 *
 * Since #1168 B9b these are the ONLY Role nodes: a lane is a `Lane` node of
 * its process, linking to the role it binds with `bindsRole`, and an
 * activity's `performedBy` reaches the role here through its lane's
 * `roleRef`. Lane-derived Roles, keyed by lane name, gave one role two nodes.
 */
/**
 * One node per outside library the layer's OWN `software-library` directory
 * holds (owner, 2026-11-13, node-kind audit: every listed node kind has an
 * IRI, a JSON-LD document and a page). The IRI is
 * `<doc dir>/softwareLibrary/<id>`, so `writeSubjectDocuments` serves it with
 * its `.jsonld`; the layer's software-libraries page links it
 * (`lib/software-library-nodes.ts`, the one reader of both). The pin, the
 * digest and the licence stay in the file (`sourcePath`).
 */
function collectSoftwareLibraries(doc: string, root: string = ROOT): Node[] {
  return softwareLibraryNodes(root).map((l) => ({
    "@id": makeIri(doc, SOFTWARE_LIBRARY_SUBJECT_KIND, l.id),
    "@type": termIri("SoftwareLibrary"),
    title: l.title,
    description: l.description,
    sourceKind: "software-library",
    sourcePath: l.sourcePath,
  }));
}

function collectDeclaredRoles(
  doc: string,
  root: string = ROOT,
  scope: CorpusScope = corpusScopeFor(root),
  /**
   * The publication base, when the caller has one — and with it a role's skill
   * held by ANOTHER layer links into that layer's document
   * ({@link skillHome}), as a Tool's `satisfies` does. Only for this
   * layer: `skillHome` asks this layer's corpus first. In the layer
   * scope this is what keeps `qc-reviewer → ig-ast-delta` from dangling
   * (measured: 3 such links the day the split landed, bean `4ak5`).
   */
  base?: string,
): Node[] {
  // EVERY declared `kg` root, not the literal `skills/` and not the first one
  // that answers. `kgRoots` is explicit that taking the first is the `dh4f`
  // defect arriving through the helper written to prevent it: a topical
  // layout (`bootstrap/`, `crdm/`) would report a clean run over the roots
  // this never visited. First declaration of a role id wins, so a later root
  // cannot silently redefine one.
  const roles = declaredRoles(root, scope);
  // NAMED by the table glossary-export applies to the same IRI (bean `lodp`,
  // finding D3; owner default applied, option 1, 2026-10-02): the display
  // name is `skos:prefLabel` and, derived from it, `dcterms:title`; the id is
  // `skos:notation`. The id was written as `rdfs:label` until then, so a
  // merged graph gave one role node `rdfs:label "reviewer"` beside
  // `skos:prefLabel "Reviewer"`.
  const naming = namingTable("role-naming");
  return roles.map((r) => ({
    "@id": makeIri(doc, "role", r.id),
    "@type": termIri("Role"),
    ...applyVocabMapping(naming, { title: r.title, id: r.id }),
    description: r.description,
    sourceKind: "role-registry",
    actorKinds: r.actorKinds,
    judgementOnly: r.judgementOnly,
    // Links, so a consumer can walk role -> skill without string surgery.
    hasSkill: (r.skills ?? []).map((n) =>
      makeIri(base !== undefined && resolve(root) === resolve(ROOT) ? skillHome(base, doc, n, scope) : doc, "skill", n),
    ),
  }));
}

/**
 * The roles the layer at `root` declares, first declaration of an id winning,
 * so a later root cannot silently redefine one. The checkout's view on the
 * platform's own run (placement PR0b): a dependent's extension adds skills to
 * a role here, by id.
 */
function declaredRoles(root: string, scope: CorpusScope = corpusScopeFor(root)): RoleDef[] {
  const roles: RoleDef[] = [];
  const seen = new Set<string>();
  for (const kgRoot of scope === "checkout" ? [root] : kgRoots(root, scope)) {
    const g = scope === "checkout" ? roleGraphFor(root, "checkout") : readRoleGraph(kgRoot);
    for (const r of g?.roles ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      roles.push(r);
    }
  }
  return roles;
}

const roleIdsByRoot = new Map<string, Set<string>>();
const declaredRoleIds = (root: string, scope: CorpusScope = corpusScopeFor(root)): Set<string> => {
  const key = `${resolve(root)}\0${scope}`;
  let ids = roleIdsByRoot.get(key);
  if (ids === undefined) roleIdsByRoot.set(key, (ids = new Set(declaredRoles(root, scope).map((r) => r.id))));
  return ids;
};

/**
 * The document a role's IRI is minted in: the one whose layer DECLARES it,
 * as {@link skillHome} does for skills. A lane of a content layer's
 * process binding cat-harness's `user` linked
 * `<site>/<that layer>/role/user`, a page no export writes, because
 * the IRI was minted in the process's own document (461 dead links on the
 * folio-assistant site, cat-harness-tools#1894). This document wins when it
 * declares the role; a role nobody declares keeps this document's IRI, so it
 * still reads as the dangling link it is.
 */
export function roleHome(base: string | undefined, ownDoc: string, roleId: string, ownRoot: string = ROOT, scope: CorpusScope = corpusScopeFor(ownRoot)): string {
  if (base === undefined || declaredRoleIds(ownRoot, scope).has(roleId)) return ownDoc;
  for (const instance of layerRootsIn(repoRootFor(ROOT))) {
    if (resolve(instance) === resolve(ownRoot)) continue;
    if (!declaredRoleIds(instance).has(roleId)) continue;
    return publishedIdentity(instance, base || undefined).docIri;
  }
  return ownDoc;
}

/**
 * One node per attestation file the layer's OWN `attestations` directory
 * holds (owner, 2026-11-13, node-kind audit: every listed node kind has an
 * IRI, a JSON-LD document and a page). The IRI is
 * `<doc dir>/attestation/<family>/<mirrored subject path>`, the file's path
 * under the store without its `.attestations.json`, so
 * `writeSubjectDocuments` serves it with its `.jsonld`. The node names its
 * family and the subject it judges; the judgements stay in the file
 * (`sourcePath`), which is what a reader of one opens.
 */
function collectAttestations(doc: string, root: string = ROOT): Node[] {
  return attestationNodes(root).map((a) => ({
    "@id": makeIri(doc, "attestation", a.id),
    "@type": termIri("QaAttestation"),
    title: a.title,
    description: a.description,
    sourceKind: a.family,
    sourcePath: a.sourcePath,
  }));
}

/**
 * One node per voice the layer's OWN `voices` directory holds, sub-graphs
 * included (owner, 2026-11-13, node-kind audit: every listed node kind has an
 * IRI, a JSON-LD document and a page). The IRI is `<doc dir>/voice/<id>`, so
 * `writeSubjectDocuments` serves it with its `.jsonld`; the voices viewer
 * draws its page and links it (`lib/voice-nodes.ts`, the one reader of both).
 * The rules stay in the file (`sourcePath`).
 */
function collectVoices(doc: string, root: string = ROOT): Node[] {
  return voiceNodes(root).map((v) => ({
    "@id": makeIri(doc, VOICE_SUBJECT_KIND, v.id),
    "@type": termIri("Voice"),
    title: v.title,
    description: v.description,
    sourceKind: "voices",
    sourcePath: v.sourcePath,
  }));
}

function collectGraphTypologies(root: string = ROOT): Node[] {
  // `fsh-guts` and anything else in UNPUBLISHED_GRAPH_TYPOLOGIES never reaches a
  // published graph. Filtered HERE, where the document is built, rather than
  // at upload: a strip that runs only on the happy path leaves a graph that
  // LOOKS clean and is not. Bean `folio-assistant-uv09`.
  const published = defaultGraphTypologies.names().filter(isPublishedGraphTypology);

  // ── EMIT ONLY WHAT THIS LAYER DECLARES.
  //
  // `defaultGraphTypologies` is the UNIVERSAL registry — every kind any layer
  // defines. Emitting all of it into every layer's graph made `bootstrap`,
  // whose whole premise is that it knows nothing yet, publish 16 GraphTypology
  // nodes when its declaration names exactly ONE (`cat-harness`, across both
  // its directories). It advertised `folio`, `voices` and `library` — core's —
  // and `beans` and `todos` — cat-harness's — none of which it can reach.
  //
  // The comment below already recorded the layering ("`voices` and `library`
  // are core's") without acting on it; this is the missing half. A bootstrap
  // that names a vocabulary it cannot resolve is the same defect as a `@type`
  // that does not dereference (`blv9`), one level up: the node is there, and
  // nothing behind it is.
  //
  // Reuses `declaredKinds` rather than re-deriving: it already follows the
  // NESTED declarations (`beans/beans.json` naming `bean-defs` and
  // `workflow-state`), which a plain read of `directories[].graphTypologies` misses —
  // and missing them here would drop kinds the layer really does own.
  //
  // Falls back to the full set when there is no declaration, because an
  // undeclared layer has said nothing about what it owns, and reporting
  // that as "owns nothing" would be a clean run over an empty set.
  const decl = readDeclaration(root);
  const owned = decl ? declaredKinds(root, decl) : undefined;
  const emitted = owned ? published.filter((n) => owned.has(n)) : published;

  return emitted.map((name) => {
    const def = defaultGraphTypologies.get(name)!;
    return {
      // The individual IS the kind — there is no class per kind (owner,
      // 2026-09-30, bean `3r47`). Its namespace is its layer's: `skills` is
      // bootstrap's, `voices` the harness's, and a `core` kind the namespace of
      // the layer that declared it. `graphTypologyIri` is the one answer, so a
      // directory's `holdsGraph` and this node cannot disagree.
      "@id": graphTypologyId(name),
      "@type": termIri("GraphTypology"),
      name,
      renderable: def.renderable,
      summary: def.summary,
    };
  });
}

/**
 * A layer's DECLARED ASSETS, as nodes.
 *
 * ## They were declared and then dropped
 *
 * `harness.json` gives each asset an id, a `src`, a `role`, a title and a
 * description, and `declaredAssets` reads and validates them — but no
 * collector emitted them, so that data reached `check-declared-assets` and
 * nothing else. A layer could declare what its files ARE and have none of
 * it appear in its own graph.
 *
 * ## Measured: it was the difference between rendering and failing
 *
 * 2026-09-20, `folio-assist-core` is a stub — a `README.md` and a declaration
 * naming it, `directories: []`. It rendered **zero** nodes and
 * `check:instance-render` failed it on "an empty graph is a failure, not an
 * empty success". That verdict was right about the graph and wrong about the
 * layer: core had declared exactly one thing about itself, and the exporter
 * discarded it. The empty graph was manufactured here.
 *
 * This is also what makes the harness layer's floor checkable. CatBootstrap owes
 * its `.json`/`.jsonld` — *"that is its existence"* — and an existence claim
 * whose declared assets are dropped is thinner than the declaration that
 * produced it.
 *
 * `exists` is carried through rather than filtered on: a declared asset whose
 * file is absent is a FINDING that `check-declared-assets` already raises, and
 * silently omitting it here would hide the node whose absence is the point.
 */
/**
 * One node per theme the layer's OWN `themes` directory declares (its
 * `themes.ts` module's `INSTANCE_THEMES`; owner, 2026-11-13, node-kind audit:
 * every listed node kind has an IRI, a JSON-LD document and a page). The IRI
 * is `<doc dir>/theme/<id>`, so `writeSubjectDocuments` serves it with its
 * `.jsonld`; the themes viewer draws its page and links it
 * (`lib/theme-nodes.ts`, the one reader of both). The palette stays in the
 * module (`sourcePath`).
 */
function collectThemes(doc: string, root: string = ROOT): Node[] {
  return themeNodes(root).map((t) => ({
    "@id": makeIri(doc, THEME_SUBJECT_KIND, t.id),
    "@type": termIri("Theme"),
    title: t.title,
    description: t.description,
    sourceKind: "themes",
    sourcePath: t.sourcePath,
  }));
}

function collectDeclaredAssets(doc: string, problems: string[], root: string = ROOT): Node[] {
  let assets: ReturnType<typeof declaredAssets>;
  try {
    assets = declaredAssets(root);
  } catch (e) {
    problems.push(`unreadable declaration for assets: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
  return assets.map((a) => ({
    "@id": makeIri(doc, "asset", a.id),
    "@type": termIri("Asset"),
    name: a.id,
    path: a.src,
    assetRole: a.role,
    title: a.title,
    description: a.description,
  }));
}

function collectDeclaration(doc: string, problems: string[], root: string = ROOT): Node[] {
  const f = declarationPathIn(root)!;
  if (!existsSync(f)) return [];
  try {
    const d = JSON.parse(readFileSync(f, "utf-8")) as {
      title?: string;
      description?: string;
      repository?: string;
      directories?: Array<{
        id: string;
        path: string;
        graphTypologies?: string[];
        title?: string;
        description?: string;
        source?: SubgraphSource;
        storage?: unknown;
      }>;
    };
    // The layer config's override, matched on id — resolved ONCE, by the
    // resolver every consumer uses, so the node publishes the same answer a
    // mount or a publisher acts on.
    const overrides = subgraphSourceOverrides(root);
    // Same exclusion on the other emitter: a declared directory holding an
    // unpublished kind would otherwise put the trashcan's id, path and
    // description into the graph, plus a `holdsGraph` edge pointing at it.
    return (d.directories ?? []).filter(isPublishedDirectory).map((x) => {
      // `graph` became `graphs[]` — a directory may hold more than one graph,
      // and `schemas/` is the first real use of that. Both spellings are read
      // so this does not break on a declaration written before the change.
      const kinds = x.graphTypologies ?? [];
      let contentSource: Record<string, unknown> | undefined;
      try {
        contentSource = contentSourceJsonLd(resolveSubgraphSource(x, overrides), d.repository);
      } catch (e) {
        problems.push(`directory "${x.id}": ${e instanceof Error ? e.message : String(e)}`);
      }
      return {
        "@id": subgraphIri(doc, x.id),
        "@type": termIri("Subgraph"),
        name: x.id,
        path: x.path,
        ...(contentSource ? { contentSource } : {}),
        holdsGraph: kinds.map(graphTypologyId),
        // `graphTypologies: kinds` was here. REMOVED as denormalised: `holdsGraph`
        // lands on a GraphTypology node whose `name` is the kind, and the export's
        // own test already asserts every one of those links resolves.
        title: x.title,
        description: x.description,
        ...(existsSync(join(root, x.path, "README.md"))
          ? { readmePath: join(x.path, "README.md").replace(/\\/g, "/") }
          : {}),
        ...((n) => (n === undefined ? {} : { fileCount: n }))(committedFileCount(join(root, x.path))),
      };
    });
  } catch (e) {
    problems.push(`unparseable declaration: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

/**
 * How many files git has committed or staged under `dir`, at any depth — the
 * commit's answer, not the worktree's, so an untracked transient never moves
 * it (bean `ba9e`). `undefined` when git cannot answer (not a work tree, or
 * the directory is absent): the node then carries no `fileCount`, which a
 * reader can tell apart from a counted zero.
 */
export function committedFileCount(dir: string): number | undefined {
  if (!existsSync(dir)) return undefined;
  // input-site: tree #f295b07d — git ls-files count of committed files under dir
  const r = spawnSync("git", ["ls-files", "-z", "--cached", "--", "."], { cwd: dir, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error !== undefined || r.status !== 0) return undefined;
  return r.stdout.split("\0").filter(Boolean).length;
}

/** Every term in the context that is declared `{"@type": "@id"}`. */
const LINK_TERMS = [
  "partOf", "requires", "performedBy", "declaresSkill", "inPackage", "inSubgraph",
  "providesCapability", "requiresCapability", "holdsGraph", "startNode",
  "incoming", "outgoing", "from", "to", "satisfies", "hasCapability",
  "hasSkill", "bindsRole", "inLane",
] as const;

/**
 * Links pointing at nodes this document does not contain.
 *
 * Only *internal* fragments are checked — a link to another document's IRI is
 * not this graph's business and reporting it would be noise. `holdsGraph`
 * points at a graph-typology IRI in the namespace, which is a vocabulary term
 * rather than a node here, so it is excluded by the same rule.
 */
/**
 * What a collector reads, and therefore which layers it can serve.
 *
 * Measured 2026-09-19 (bean `gn4l`) by reading each collector rather than
 * trusting its name. The distinction is NOT "does it mention `ROOT`" — two of
 * the instance-bound ones do not.
 */
export const COLLECTOR_SCOPE = {
  /** Reads only DECLARED directories, so any layer with a declaration works. */
  generic: ["skills", "processes", "declaredRoles", "declaration", "tools", "schemas"],
  /** Reads nothing instance-specific at all — the global graph-typology registry. */
  universal: ["graphTypologies"],
  /**
   * Bound to THIS repository, and each for a different reason:
   *
   * - `registry` — `.claude/skills/<group>` as a path literal.
   * - `packages` — `package-manifest.json` plus directories named in code.
   *
   * `schemas` WAS listed here: `collectSchemas` audited only the harness's own
   * `schemas/`. `auditSchemaNodes` takes a root, so `collectSchemas` now reads
   * the exported layer's declared `schemas` graph and it is generic.
   *
   * `tools` WAS listed here as import-bound: a compile-time `import` of
   * `tools/index.ts`, which a root could not redirect. Discovery (bean
   * `p0za`) replaced that import with a read of each layer's declared
   * `tools` graph, and `collectTools` takes the root (bean `tdir`), so it is
   * generic now. The stale entry is what let `--instance` exports publish no
   * Tools while `omitted` said only that they had not been looked for.
   */
  instanceBound: ["registry", "packages"],
} as const;

/**
 * The nodes ANY declared layer contributes — bootstrap included.
 *
 * ## Why this exists rather than a `--root` flag
 *
 * A flag reads like the fix and is not. `kg-export` was never merely rooted at
 * this repository; it is **written for its shape**. Adding `--root` and
 * calling the whole pipeline would make it export a minimal layer *as if
 * that layer were folio-assistant* — walking `.claude/skills/`, demanding a
 * `package.json`, auditing schema nodes it does not have, and serving
 * folio-assistant's own compiled-in tools as though they were its.
 *
 * So the seam is drawn by **what a collector reads**, per
 * {@link COLLECTOR_SCOPE}, and this function is the generic side of it.
 *
 * ## An absent section is NOT an audited-empty one
 *
 * `omitted` names every instance-bound collector that was not run, so a
 * consumer can tell "this instance has no tools" from "tools were never
 * looked for". Rendering the second as the first is the `dh4f` defect — a
 * consumer scanning nothing and reporting a clean run over it — and it is the
 * specific risk of exporting a minimal layer through machinery built for a
 * maximal one.
 */
export async function collectInstanceNodes(
  root: string,
  doc: string,
  base: string,
  problems: string[],
  /**
   * The base of the site that serves this checkout's diagram SVGs — this
   * layer's — when the caller publishes there. See `collectProcesses`.
   */
  siteBase?: string,
  /** The deploy's `--base-url`, for a skill's link to a published contract. See `collectSkills`. */
  baseUrl?: string,
): Promise<{ nodes: Node[]; omitted: readonly string[]; notes: string[] }> {
  const notes: string[] = [];
  const nodes = [
    ...collectSkills(doc, base, problems, root, corpusScopeFor(root), baseUrl),
    ...(await collectProcesses(doc, problems, root, notes, siteBase, corpusScopeFor(root), base)),
    ...collectTranslationSources(doc, root),
    ...collectGraphTypologies(root),
    ...collectAttestations(doc, root),
    ...collectVoices(doc, root),
    ...collectDeclaredRoles(doc, root),
    ...collectDeclaration(doc, problems, root),
    ...collectThemes(doc, root),
    ...collectDeclaredAssets(doc, problems, root),
    // Every declared `tools` graph is read by discovery, so Tools are generic
    // (bean `tdir`). The type vocabulary is the harness's: `baseUrl`, the
    // deploy's own `--base-url`, or the harness's declared base when none.
    ...collectTools(doc, base, problems, corpusScopeFor(root), root, baseUrl),
    // The layer's own declared `schemas` graph, read the way the host's is
    // (`auditSchemaNodes` takes the root), so a layer's schema modules are
    // published as nodes. `buildExport` links each to its `zod/` renderings.
    ...collectSchemas(doc, base, "instance", root),
    ...collectSoftwareLibraries(doc, root),
  ];
  // A LINK TO AN OMITTED COLLECTOR'S NODES MUST NOT BE EMITTED.
  //
  // `collectSkills` puts `inPackage` on every skill, and the package nodes are
  // minted by `collectPackages` — which is instance-bound and therefore NOT
  // run here. Left in place that is 7 dangling links in bootstrap's
  // export, measured: every skill pointing at `#package/skills` or
  // `#package/render`, neither of which this document can contain.
  //
  // Stripped rather than faked: emitting a package node the generic path did
  // not collect would assert membership of something nobody enumerated. The
  // omission is already reported through `omitted`, so a reader can tell
  // "this instance has no packages" from "packages were never looked for" —
  // which is the distinction that would be lost by silently keeping a link
  // that happens to resolve in a different document.
  //
  // Found because the FIRST reading of this was vacuous: `danglingLinks` is
  // computed but not written into the published document, so reading the file
  // and defaulting an absent key to `[]` reported zero. The in-memory export
  // says seven. A default that stands in for an absent field is not an
  // answer.
  for (const n of nodes) if ("inPackage" in n) delete (n as Record<string, unknown>).inPackage;

  return { nodes, omitted: COLLECTOR_SCOPE.instanceBound, notes };
}

function undeclaredTerms(
  graph: Node[],
  context: Record<string, unknown>,
): Array<{ term: string; onTypes: string[]; occurrences: number }> {
  const declared = new Set(Object.keys(context).filter((k) => !k.startsWith("@")));
  const seen = new Map<string, { types: Set<string>; n: number }>();
  for (const node of graph) {
    const type = String(node["@type"] ?? "").split(/[#/]/).pop() ?? "?";
    for (const key of Object.keys(node)) {
      if (key.startsWith("@") || declared.has(key)) continue;
      const e = seen.get(key) ?? { types: new Set<string>(), n: 0 };
      e.types.add(type);
      e.n += 1;
      seen.set(key, e);
    }
  }
  return [...seen.entries()]
    .map(([term, e]) => ({ term, onTypes: [...e.types].sort(), occurrences: e.n }))
    .sort((a, b) => b.occurrences - a.occurrences || a.term.localeCompare(b.term));
}

/**
 * A node carrying both a JSON-LD keyword and an alias of it.
 *
 * **Fatal, unlike `undeclaredTerms`**, and the difference is what is at stake.
 * An undeclared term loses one property; a collision on `id` or `type` offers
 * a processor two different answers for the node's own IDENTITY or CLASS, and
 * a graph whose nodes cannot be identified is not a graph. Publishing that as
 * a complete export is the failure this module's doc comment is about.
 *
 * Measured before the fix: 71 nodes — `Actor.id` (24), `Actor.type` (24),
 * `Capability.id` (23) — all from `collectRegistryNodes` spreading a registry
 * file's own fields into the node object verbatim.
 */
function keywordCollisions(graph: Node[]): string[] {
  const aliases = keywordAliases();
  const out: string[] = [];
  for (const node of graph) {
    for (const key of Object.keys(node)) {
      if (!aliases.has(key)) continue;
      const kw = `@${key === "graph" ? "graph" : key}`;
      if (kw in node) out.push(`${String(node["@id"])} carries both \`${kw}\` and its alias \`${key}\``);
    }
  }
  return out;
}

function findDanglingLinks(graph: Node[], docIri: string): Array<{ from: string; edge: string; to: string }> {
  const ids = new Set(graph.map((n) => String(n["@id"])));
  const out: Array<{ from: string; edge: string; to: string }> = [];
  for (const n of graph) {
    for (const edge of LINK_TERMS) {
      const v = n[edge];
      if (v === undefined) continue;
      for (const to of Array.isArray(v) ? v : [v]) {
        const t = String(to);
        // "Internal" means a subject THIS document mints: `<doc dir>/<kind>/…`
        // with a known kind (`subjectPathOf`). Testing for a bare `#` was
        // wrong: FOLIO_NS itself ends in `#`, so every vocabulary IRI read as
        // a broken node reference; and testing for the doc dir alone would
        // claim every other layer's subjects for the host, whose document
        // sits at the site root.
        if (ids.has(t) || subjectPathOf(t, docIri) === undefined) continue;
        out.push({ from: String(n["@id"]), edge, to: t });
      }
    }
  }
  return out;
}

/** Strip `undefined` so the published JSON has no empty keys. */
export function compact(n: Node): Node {
  return Object.fromEntries(Object.entries(n).filter(([, v]) => v !== undefined)) as Node;
}

/**
 * Where the export is published, and therefore what its `@id`s are.
 *
 * `baseUrl` overrides the declaration's `canonicalUrl` — CI passes the staging
 * base so a branch preview's graph identifies itself as the preview rather
 * than claiming to be the canonical one. Without that override every staged
 * export would mint `@id`s pointing at `main`'s published document, and two
 * different graphs would assert the same IRIs.
 */
export interface ExportOptions {
  baseUrl?: string;
  /**
   * The layer whose identity this is — defaults to the one this module
   * lives in.
   *
   * `collectInstanceNodes` has taken a root since `gn4l` separated the generic
   * collectors from the instance-bound ones, but IDENTITY did not follow it:
   * `exportIdentity` read `ROOT` unconditionally, so every layer's nodes
   * were minted into THIS layer's document IRI. That was invisible while
   * only one document was ever built.
   *
   * It stops being invisible the moment one graph must REFERENCE another —
   * bean `pve3`, where a Tool in cat-harness satisfies a skill published in
   * bootstrap's graph and the link has to name bootstrap's document.
   */
  instanceRoot?: string;
  /**
   * Whose directories the HOST's collectors read — bean `4ak5` item 2.
   *
   * `"instance"`, the default, is what this layer PUBLISHES. Owner ruling
   * 2026-10-05 (option B, the full split): `cat-harness.jsonld` holds
   * cat-harness's own declared directories, and every layer stacked on it
   * is in that layer's own document (`instance-exports.ts`). Measured the
   * day it landed: 825 of 3369 nodes were other layers' — 495 of them
   * the content core's — under `cat-harness.jsonld#…` fragments. Each
   * `@id` the checkout graph had and this one lacks is in its owner's
   * document; nothing here forwards it (clean break, cat-harness-tools#1378).
   *
   * `"checkout"` is {@link corpusScopeFor}'s answer for this layer, and is
   * for a caller that wants the corpus-wide graph rather than the published
   * document — `gen-slice-sqlite`'s `kg` slice says so at its call site.
   *
   * Ignored for a foreign layer, which is built from the generic
   * collectors in its own scope already.
   */
  scope?: CorpusScope;
  /**
   * Whether to ask git for the document-level source provenance (`sourceCommit*`,
   * `sourceTreeDirty`). Defaults to `true`. A caller that reads only `@graph`
   * (`gen-slice-sqlite`, `gen-subgraph-jsonld`) passes `false` so it neither
   * runs `git status` nor records `HEAD` as an input.
   */
  provenance?: boolean;
}

/** Filename stem and document IRI for this layer's published graph. */
/**
 * The commit this graph was generated from, or why that could not be
 * determined.
 *
 * ## Why the timestamp alone was not enough
 *
 * `generatedAt` says WHEN the export ran. It does not say what it ran over,
 * so two graphs differing in content are indistinguishable from two runs of
 * the same content, and a consumer holding a published `.jsonld` has no way
 * back to the tree that produced it. The commit is the missing half: with it,
 * the graph is reproducible and every node in it is traceable to a diff.
 *
 * ## Dirty is a THIRD state, not a detail
 *
 * A SHA reported from a tree with uncommitted changes is a false provenance
 * claim — it names a commit that does not contain what was exported, which is
 * strictly worse than reporting nothing, because it invites a consumer to
 * check out that commit and find a different graph. So `dirty` is carried
 * beside the SHA rather than suppressing it: the commit is still the best
 * available anchor, and the flag says not to trust it as exact.
 *
 * ## And unavailable is a fourth
 *
 * A tarball, a shallow or export-stripped checkout, or a machine with no
 * `git` produces no SHA at all. That is reported in `problems` — the same
 * channel as an unreadable source — and the fields are simply absent, never
 * filled with a placeholder that would parse as a commit.
 */
export interface SourceProvenance {
  sha?: string;
  /** The commit's web URL, when the remote names a forge we can address. */
  iri?: string;
  committedAt?: string;
  /** `HEAD^{tree}`: the tree, which a PR's merge ref and main's merge commit share. */
  tree?: string;
  dirty?: boolean;
  /** Why there is no SHA, when there is none. */
  unavailable?: string;
}

/**
 * `root` defaults to this layer, which is what every export reads. It is a
 * parameter so a test can hand it a throwaway repository whose `origin` is
 * known: the IRI derivation is logic over whatever remote it is given, and
 * this checkout's remote is not something every clone has.
 */
export function readSourceProvenance(root: string = ROOT): SourceProvenance {
  const git = (args: string[]): string | undefined => {
    // input-site: tree; head #952da9d7 — HEAD commit, status, and remote origin for source provenance
    const r = spawnSync("git", args, { cwd: root, encoding: "utf-8" });
    if (r.status !== 0 || r.error) return undefined;
    return r.stdout.trim();
  };

  const sha = git(["rev-parse", "HEAD"]);
  if (!sha) {
    return {
      unavailable:
        "git reported no HEAD here (a tarball, an export-stripped checkout, " +
        "or no git on PATH), so the graph names no source commit",
    };
  }

  // `--porcelain` is empty exactly when the tree matches HEAD. Untracked files
  // count: an export walks the tree, so a file git does not know about is
  // still a file that could have contributed a node.
  const status = git(["status", "--porcelain"]);
  return {
    sha,
    iri: commitIri(git(["remote", "get-url", "origin"]), sha),
    committedAt: git(["show", "-s", "--format=%cI", sha]) || undefined,
    tree: git(["rev-parse", "HEAD^{tree}"]) || undefined,
    // `undefined` rather than `false` when status itself failed: "the tree is
    // clean" is a claim, and an unanswered question is not that claim.
    dirty: status === undefined ? undefined : status.length > 0,
  };
}

/**
 * A dereferenceable commit URL from a git remote, or `undefined`.
 *
 * Only forge URLs whose commit-page layout is known are turned into an IRI —
 * `undefined` for anything else, never a guessed path. Same rule as
 * `makeIri`'s: a link that looks dereferenceable and 404s is worse than an
 * absent one, because a consumer treats the first as a fact about the graph
 * and the second as a fact about this export.
 */
function commitIri(remote: string | undefined, sha: string): string | undefined {
  if (!remote) return undefined;
  const m =
    remote.match(/^https?:\/\/(github\.com|gitlab\.com)\/(.+?)(?:\.git)?\/?$/) ??
    remote.match(/^git@(github\.com|gitlab\.com):(.+?)(?:\.git)?\/?$/);
  if (!m) return undefined;
  const [, host, path] = m;
  // GitHub and GitLab both serve a commit at /<owner>/<repo>/commit/<sha>.
  return `https://${host}/${path}/commit/${sha}`;
}

export function exportIdentity(opts: ExportOptions = {}): {
  stub: string;
  docIri: string;
  /**
   * The publication base every IRI in this export is minted against.
   *
   * Returned rather than re-derived by each caller. `collectTools` used to
   * recover it by stripping `/kg/<file>` off `docIri` with a regular
   * expression — which works, and is exactly the "process the string to get
   * back a fact you already had" that this project keeps removing. Two callers
   * doing it is two chances to disagree about what the base is.
   */
  base: string;
  /**
   * The document's path under the publication base — and under `_site/`,
   * which is the same thing because `_site/` is served at the base.
   *
   * Returned rather than recomposed from `stub`, for the reason `base` is:
   * a document sits at `<name>/<stub>.jsonld` (bean `dyd3`; the host too
   * since 2026-10-23), and only one with its own `canonicalUrl` at
   * `<stub>.jsonld`. A caller that
   * rebuilds it from the stub gets the host's answer for every layer, and
   * the QA sidecar did exactly that — naming its findings' subject as a
   * document at a path nothing writes.
   */
  docPath: string;
  /**
   * Where this document was published until 2026-10-23, when that is not
   * `docPath`: the host's `<stub>.jsonld` at the site root, before every
   * layer's document moved under `<base>/<name>/` (#603 decision 1b). Only
   * `placedOut` reads it, so a deploy step still naming the old `--out` path
   * writes to the new one. Nothing is published there (clean break, #1378).
   */
  legacyDocPath?: string;
  /** {@link legacyDocPath} as an IRI under `base`. */
  legacyDocIri?: string;
  /** The canonical document's IRI, when one is declared. */
  canonicalIri?: string;
  /** True when this export is published somewhere other than canonical. */
  isPreview: boolean;
  /**
   * The layer directory this export is OF — `opts.instanceRoot` resolved,
   * or this one.
   *
   * Returned for the same reason `base` is: a caller that needs to say which
   * declaration was consulted would otherwise repeat the `?? ROOT` default,
   * and a second copy of a default is a second chance to disagree with it.
   */
  instanceDir: string;
  /** Is this a layer other than the one the exporter lives in? */
  foreignInstance: boolean;
  /**
   * Is that layer one THIS repository publishes?
   *
   * Returned rather than recomputed because the caller's diagnostic turns on
   * it, and a second path-boundary comparison is a second chance to write
   * `startsWith` and call `/repo-other` a child of `/repo`.
   */
  publishedHere: boolean;
} {
  const instance = opts.instanceRoot ?? ROOT;
  // Foreign = a layer other than the one this exporter lives in. The same
  // test `buildExport` uses to pick the generic collectors, so the identity
  // and the content cannot disagree about which layer this is.
  const foreignInstance = opts.instanceRoot !== undefined && resolve(opts.instanceRoot) !== resolve(ROOT);
  const decl = readDeclaration(instance);
  // `package.json` is the REPOSITORY's and is the fallback stub for a
  // layer that declares nothing, so it is read from the repo root rather
  // than from `instance` — a nested layer has none, and reading one from
  const pkgPath = join(repoRootFor(ROOT), "package.json");
  const pkg = existsSync(pkgPath) ? (JSON.parse(readFileSync(pkgPath, "utf-8")) as { name?: string }) : {};
  const stub = decl ? artefactStub(decl) : (pkg.name ?? "instance");
  // The publication base belongs to the SITE DOING THE PUBLISHING, not to the
  // layer whose graph is being exported — so a foreign layer that
  // declares no `canonicalUrl` of its own falls back to this one's.
  //
  // This is the same argument the `stub` line above already makes about
  // `package.json`, and not applying it here is what took `docs-site.yml` red
  // on `main` for every push between 11:31 and 14:0x on 2026-09-21 (bean
  // `40fl`). `bootstrap` declares no `canonicalUrl` DELIBERATELY — it has
  // no site of its own, as its own declaration says at length — but its graph
  // is published into THIS site, at `<base>/bootstrap.jsonld`, by the very
  // step that was failing. So "the exported instance declares no base" was
  // never the same question as "this document has no base".
  //
  // Fallback, never override: a layer that declares its own canonical URL
  // keeps it, because then the document really does belong somewhere else.
  //
  // AND ONLY FOR A LAYER THIS REPOSITORY ACTUALLY PUBLISHES. The first
  // version of this fallback (mine, #718) had no such condition, and that was
  // wrong in the quiet direction: a layer root outside this checkout got
  // THIS site's base, so exporting `/tmp/outside` minted
  // `https://litlfred.github.io/folio-assistant/outside.jsonld` — a URL that
  // will never resolve, claiming a document this repository does not publish,
  // and reported as no problem at all. Measured, not reasoned: that is what
  // the command printed before this line existed.
  //
  // `bootstrap` inherits because it IS published here, by the deploy step
  // one function away. `/tmp/outside` is not, so the honest answer there is
  // the third state the next block already implements — a document-relative
  // `@id` plus a reported problem — because a base for it would be a guess
  // wearing the clothes of a fact. Same rule `makeIri` follows.
  //
  // A path-boundary comparison, never `startsWith`: `/repo-other` begins with
  // `/repo` and is not inside it.
  const repoRoot = resolve(repoRootFor(ROOT));
  const here = resolve(instance);
  const publishedHere = here === repoRoot || here.startsWith(repoRoot + sep);
  const ownCanonical = decl?.canonicalUrl ?? "";
  const publisherCanonical = ownCanonical || !publishedHere ? "" : (readDeclaration(ROOT)?.canonicalUrl ?? "");
  const canonicalBase = (ownCanonical || publisherCanonical).replace(/\/+$/, "");
  const base = (opts.baseUrl ?? canonicalBase).replace(/\/+$/, "");
  // No base declared → a document-relative IRI. Deliberately NOT a fabricated
  // absolute one: see makeIri's note on links that look dereferenceable.
  // `renderingPath` rather than a template literal: the `kg/` segment that used
  // to be here was written out in seven places, five of them minting an `$id`.
  // An empty base still yields a document-RELATIVE IRI, deliberately — see
  // `makeIri`'s note on links that look dereferenceable.
  // ── WHERE A FOREIGN LAYER'S DOCUMENT LIVES — `<base>/<name>/<stub>.jsonld`
  //
  // The owner's URL-space rule (bean `x0hj`): the base IS one layer's
  // rendering, and **everything else is
  // `<baseurl>/<instantiated harness>/<path to rendered content>`** — with
  // `<baseurl>/bootstrap/bootstrap.jsonld` named as the worked example.
  //
  // So the host published at the root and a foreign layer under its own
  // segment — until 2026-10-23, below, when the host joined them. This was `<base>/<stub>.jsonld` for both until `dyd3`,
  // which is how bootstrap's graph came to exist at TWO paths under TWO
  // `@id`s — 88 subjects with two identities no consumer would ever merge.
  // Measured 2026-09-21: the site-root path had the 2 links and violated the
  // rule; the `bootstrap/` path conformed and had none.
  //
  // UNLESS THE LAYER DECLARES ITS OWN `canonicalUrl`. Then the base is its
  // own site, where it is the host, so it sits at `<canonicalUrl>/<stub>.jsonld`.
  // Appending the foreign segment there doubled it: the FHIR IG harness minted
  // `…/<stub>/<stub>/<stub>.jsonld` (issue #1548, measured
  // 2026-09-30). `bootstrap` declares no base and is unchanged.
  //
  // The segment is the layer's NAME, through the one resolver
  // (`instanceDocPath`, bean `cat-tools-sthf`); `stub` names the file. They
  // are equal for every layer declared today, so this moved no address.
  //
  // ── AND THE HOST TOO, since 2026-10-23 ─────────────────────────────────
  //
  // The host published at the root until the owner's ruling of 2026-10-23
  // (litlfred/cat-harness-tools#603, decision 1b(i), "move all"): *the host
  // is no longer special*. Its document, its Tools and its subjects sit under
  // `<base>/<name>/` like every other layer's — one rule for every layer, and
  // subjects beside their document. The root address it had is
  // `legacyDocPath`; nothing is published there any more (#1378).
  //
  // A foreign layer with its OWN `canonicalUrl` is unchanged here: on its
  // own site it is the host, and where its document goes there is phase 2 of
  // #603 (litlfred/cat-harness-tools#638).
  const rootDocPath = `${stub}.jsonld`;
  const docPath = foreignInstance && ownCanonical ? rootDocPath : instanceDocPath({ name: decl?.name ?? stub, stub });
  const docIri = renderingPath(base, docPath);
  const canonicalIri = canonicalBase ? renderingPath(canonicalBase, docPath) : undefined;
  const legacyDocPath = foreignInstance ? undefined : rootDocPath;
  return {
    stub,
    docIri,
    base,
    docPath,
    ...(legacyDocPath === undefined ? {} : { legacyDocPath, legacyDocIri: renderingPath(base, legacyDocPath) }),
    canonicalIri,
    isPreview: canonicalIri !== undefined && docIri !== canonicalIri,
    instanceDir: instance,
    publishedHere,
    foreignInstance,
  };
}

/**
 * The identity a layer's PUBLISHED document has — {@link exportIdentity}
 * with `baseUrl` passed exactly when the deploy passes it.
 *
 * `instance-exports.ts` gives a layer that declares its own
 * `canonicalUrl` no `--base-url` ({@link declaresOwnCanonical}), so its
 * `@id`s are minted against that whatever site builds it. Anything here that
 * names a node in ANOTHER layer's document has to mint the same way, or it
 * names a document nobody writes: `skillHome` passed this site's base and got
 * `<site>/<stub>.jsonld` for a DAK base layer, which the deploy never writes (measured
 * 2026-10-05, bean `4ak5` item 2).
 */
export function publishedIdentity(instanceRoot: string, baseUrl?: string): ReturnType<typeof exportIdentity> {
  const own = declaresOwnCanonical(readDeclaration(instanceRoot));
  return exportIdentity({ instanceRoot, ...(baseUrl !== undefined && !own ? { baseUrl } : {}) });
}

/**
 * The schema directory a layer publishes beside its document — bean
 * `4ak5` item 1, owner ruling 2026-10-05 (option B).
 *
 * Here rather than in `harness-schema-export.ts` for one reason: the `$id`s
 * are minted at the layer's PUBLISHED identity, and that is
 * {@link publishedIdentity}'s answer, which lives in this module. The builder
 * takes the identity as an argument; this is the one place the two meet, so
 * the deploy (`instance-exports.ts`) and the gate that checks it
 * (`check:published-instance-exports`) cannot compose them differently.
 */
export function publishedInstanceSchemas(instanceRoot: string, baseUrl?: string, zod?: ZodSchemaScan): InstanceSchemaExport {
  return buildInstanceSchemas(instanceRoot, publishedIdentity(instanceRoot, baseUrl), { baseUrl, ...(zod ? { zod } : {}) });
}

/**
 * {@link publishedInstanceSchemas} WITH the layer's public Zod schemas —
 * what the deploy writes (part 2, owner ruling 2026-10-05, option C: "every
 * exported *Schema").
 *
 * Async because the scan imports modules. The synchronous form stays for the
 * callers whose question does not depend on the scan (the index `$id`, the
 * contracts); the deploy and the gate's Zod check both call THIS, so they
 * cannot compose the scan and the build differently.
 */
export async function scannedInstanceSchemas(instanceRoot: string, baseUrl?: string): Promise<InstanceSchemaExport> {
  return publishedInstanceSchemas(instanceRoot, baseUrl, await scanInstanceZodSchemas(instanceRoot));
}

/**
 * The declared Subgraph node a PUBLISHER points at — its absolute IRI in the
 * declaring layer's published document, and its resolved content source in
 * the JSON-LD form this exporter writes on that node (bean `l4ay`,
 * `scripts/subgraph-node.ts`).
 *
 * Here because the document IRI is {@link exportIdentity}'s answer, and a
 * publisher that recomposed it would be a second answer to where the node is.
 * `undefined` when no layer in the checkout declares the id.
 */
export function declaredSubgraphNode(
  start: string,
  id: string,
  opts: { baseUrl?: string } = {},
): { iri: string; contentSource: Record<string, unknown>; declared: DeclaredSubgraph } | undefined {
  const declared = declaredSubgraph(start, id);
  if (declared === undefined) return undefined;
  const { docIri } = exportIdentity({ instanceRoot: declared.instanceRoot, ...(opts.baseUrl ? { baseUrl: opts.baseUrl } : {}) });
  return {
    iri: subgraphIri(docIri, id),
    contentSource: contentSourceJsonLd(declared.source, declared.repository),
    declared,
  };
}

export async function buildExport(opts: ExportOptions = {}): Promise<Export> {
  const problems: string[] = [];
  const {
    stub,
    docIri,
    base,
    docPath,
    canonicalIri,
    isPreview,
    instanceDir: exportedInstance,
    publishedHere: exportedInstancePublishedHere,
  } = exportIdentity(opts);

  // Provenance of the SOURCE. Absent fields are absent, never placeholders:
  // a consumer must be able to tell "this export did not know" from "this
  // export knew the tree was clean".
  // NOT folded into `problems`, whose contract is "sources that could not be
  // read". A dirty tree is not an unread source — the export saw everything —
  // it is a caveat on the SHA, and a dirty checkout is the normal state of a
  // developer's machine. Putting it there would make `problems: []` fail on
  // every local run and train the reader to ignore the field that exists to
  // report real failures.
  const src: SourceProvenance = opts.provenance === false ? {} : readSourceProvenance();
  const commitFields = {
    ...(src.unavailable ? { sourceCommitUnavailable: src.unavailable } : {}),
    ...(src.iri ? { sourceCommit: src.iri } : {}),
    ...(src.sha ? { sourceCommitSha: src.sha } : {}),
    ...(src.tree ? { sourceTree: src.tree } : {}),
    ...(src.committedAt ? { sourceCommitAt: src.committedAt } : {}),
    ...(src.dirty === undefined ? {} : { sourceTreeDirty: src.dirty }),
  };
  if (!docIri.startsWith("http")) {
    // Reported, not silently tolerated: a graph whose nodes have no absolute
    // identity cannot be merged with anyone else's, which is most of the point.
    //
    // NAMES THE FILE IT ACTUALLY LOOKED IN, resolved rather than spelled. This
    // message said `harness.json` until bean `40fl` — a filename excised by
    // #695 — so the one reader it exists for was sent to a file that is not
    // there, while the real declaration sat one rename away. A diagnostic that
    // names a retired path is worse than a bare one: it reads as specific.
    //
    // AND IT SAYS WHICH OF THE TWO REASONS APPLIES. "none declared by the
    // publishing instance" was true when the fallback was unconditional and
    // became false the moment it gained a boundary: for a layer outside
    // this checkout the host DOES declare a base, it simply does not extend
    // there. A diagnostic that names the wrong reason sends its reader to add
    // a `canonicalUrl` that is already present.
    const looked = declarationPathIn(exportedInstance);
    const where = looked
      ? relative(repoRootFor(ROOT), looked)
      : `${relative(repoRootFor(ROOT), exportedInstance)} (no declaration found)`;
    const why = exportedInstancePublishedHere
      ? ", and none declared by the publishing instance"
      : ", and it resolves outside this repository, so the publishing instance's base does not extend to it";
    problems.push(
      `no canonicalUrl in ${where}` +
        why +
        ", and no --base-url given: " +
        "@id values are document-relative and will not dereference",
    );
  }

  // ANOTHER layer's document is built from the GENERIC collectors only.
  //
  // `opts.instanceRoot` already gave this export bootstrap's identity —
  // its stub, its docIri. Running the list below unchanged would then fill
  // that document with THIS layer's content: cat-harness's 222 skills and
  // 55 processes published as `bootstrap.jsonld`. A graph that is wrong
  // about whose it is, under a name a consumer trusts.
  //
  // `COLLECTOR_SCOPE` already states which collectors are instance-bound and
  // why (`gn4l`, 2026-09-19), and `collectInstanceNodes` is the generic side
  // of that seam. So the branch is not a special case bolted on here — it is
  // the seam being used for the first time by something other than a test.
  const foreign = opts.instanceRoot !== undefined && resolve(opts.instanceRoot) !== resolve(ROOT);
  const scope: CorpusScope = opts.scope ?? "instance";
  // Audited over the layer being exported, not over this one. For a
  // foreign layer that is honestly empty (bootstrap declares no
  // `schemas/`), where a hand-built empty object would be asserting the same
  // thing without having looked.
  const schemaAudit = foreign ? auditSchemaNodes(opts.instanceRoot!) : auditSchemaNodes(ROOT, scope);
  const instanceOnly = foreign
    ? await collectInstanceNodes(
        opts.instanceRoot!,
        docIri,
        base,
        problems,
        // The pictures are on THIS site — the host's base, which for a
        // layer with its own `canonicalUrl` is not `base`.
        exportedInstancePublishedHere ? exportIdentity({ baseUrl: opts.baseUrl }).base || undefined : undefined,
        opts.baseUrl,
      )
    : undefined;
  const graph = (
    instanceOnly
      ? instanceOnly.nodes
      : [
          ...collectSkills(docIri, base, problems, ROOT, scope, opts.baseUrl),
          ...collectRegistryNodes(docIri, problems),
          ...collectPackages(docIri, problems, scope),
          ...(await collectProcesses(docIri, problems, ROOT, undefined, base, scope, base)),
          ...collectTools(docIri, base, problems, scope, ROOT, base || undefined),
          ...collectSchemas(docIri, base, scope),
          ...collectTranslationSources(docIri, ROOT),
          ...collectExternalSchemas(docIri),
          ...collectSoftwareLibraries(docIri, ROOT),
          ...collectGraphTypologies(),
          ...collectAttestations(docIri, ROOT),
          ...collectVoices(docIri, ROOT),
          ...collectDeclaredRoles(docIri, ROOT, scope, base),
          ...collectDeclaration(docIri, problems),
          ...collectThemes(docIri, ROOT),
          ...collectDeclaredAssets(docIri, problems),
        ]
  ).map(compact);

  linkSchemas(graph, foreign ? opts.instanceRoot! : ROOT);

  stampSubgraph(graph, docIri, exportedInstance);

  // A preview's nodes say, explicitly and per node, which canonical node they
  // are an alternate presentation of.
  //
  // This IS derivable — `makeIri` produces the same fragment whatever the base,
  // so a consumer could swap one for the other. It is written out anyway, on
  // the owner's standing instruction that a downstream consumer must never have
  // to string-manipulate or infer a rule to follow a link. A rule a consumer
  // has to know is a rule a consumer can get wrong, and the cost here is one
  // field per node in an artefact that is regenerated on every build.
  if (isPreview && canonicalIri !== undefined) {
    for (const n of graph) {
      const id = String(n["@id"]);
      // Only nodes that are fragments of THIS document have an alternate.
      // Vocabulary nodes (graph typologies) are minted under the namespace, not the
      // document, so they are byte-identical in both graphs — giving them an
      // `alternateOf` pointing at a canonical fragment that does not exist was
      // a broken link generated by a blanket loop.
      // A Tool is its own document BESIDE this one (bean `tdir`), so its
      // alternate is the same Tool beside the canonical document.
      if (n["@type"] === termIri("Tool") && id === toolIri(docIri, String(n.name))) {
        n.alternateOf = toolIri(canonicalIri, String(n.name));
        continue;
      }
      const path = subjectPathOf(id, docIri);
      if (path === undefined) continue;
      n.alternateOf = `${subjectBase(canonicalIri)}${path}`;
    }
  }

  // §3.4. Computed over the layer being EXPORTED, not over this one — a
  // foreign layer's document states that layer's dependency set, and
  // reading it from `ROOT` would publish cat-harness's stack under
  // bootstrap's name. Same seam, same reason, as `schemaAudit` above.
  const deps = dependsOnFor(exportedInstance);
  const dependsOnFields = {
    ...(deps.unavailable === undefined
      ? { dependsOn: deps.records, ...(deps.gaps.length > 0 ? { dependsOnGaps: deps.gaps } : {}) }
      : { dependsOnUnavailable: deps.unavailable }),
  };

  const counts: Record<string, number> = {};
  for (const n of graph) {
    // Strip WHICHEVER namespace applies. A single `.replace(FOLIO_NS, "")`
    // silently left the full IRI as the key once the namespaces split, which
    // reads as a plausible-looking count under a very long label rather than
    // as an error.
    const t = stripNamespace(String(n["@type"]));
    counts[t] = (counts[t] ?? 0) + 1;
  }

  // The layer's schema index (bean `4ak5` item 1), linked from the document
  // ONLY when the deploy writes it: `instance-exports.ts` publishes a
  // `schema/` directory for exactly the layers in its plan, so the test is
  // that plan's own answer rather than a second list. `dcterms:conformsTo`,
  // the term this export already uses for "the specification a node is
  // written against" — here, of the layer's declaration and contracts.
  // Minted from THIS export's identity, which is the published one whenever
  // the deploy runs it (`publishedIdentity`).
  //
  // The HOST links its own `<stub>.schema.json` (follow-up, owner-approved
  // 2026-10-05): the shared declaration schema, by the `$id`
  // `harness-schema-export.ts` gives it in a build with the same base —
  // `buildDeclarationSchema` itself, not a recomposition. With no base that
  // has no `$id`, so the link is absent rather than relative.
  const schemaIndex = foreign
    ? publishesInstanceSchema(exportedInstance)
      ? instanceSchemaIndexIri({ stub, base, docPath })
      : undefined
    : (buildDeclarationSchema({ baseUrl: opts.baseUrl }).$id as string | undefined);

  // Each Schema node of a layer that publishes `<stub>/schema/` names the
  // JSON Schema renderings of its exports — minted by the publisher's own
  // function, so the link and the file come from one identity. A layer that
  // publishes none gets nodes without the link, never a link to nothing.
  if (foreign && schemaIndex !== undefined && graph.some((n) => n["@type"] === termIri("Schema"))) {
    const zod = (await scannedInstanceSchemas(opts.instanceRoot!, opts.baseUrl)).zod;
    for (const n of graph) {
      if (n["@type"] !== termIri("Schema") || typeof n.module !== "string") continue;
      const links = zod.filter((r) => r.module === n.module).map((r) => String(r.schema.$id ?? r.published));
      if (links.length > 0) n.jsonSchema = links;
    }
  }

  // `schemas` is no longer instance-bound (`COLLECTOR_SCOPE`): every export
  // reads its own layer's `schemas` graph, so it is never in `omitted`.
  const omitted = instanceOnly === undefined ? undefined : instanceOnly.omitted;

  return {
    "@context": buildContext(),
    danglingLinks: findDanglingLinks(graph, docIri),
    "@id": docIri,
    ...(schemaIndex !== undefined ? { conformsTo: schemaIndex } : {}),
    // A preview says so in its TYPE, not only in a side-car field: "is this
    // the canonical graph?" must be answerable from the document's own type
    // without reading a convention. This is where the `#branches/` marker idea
    // belongs — as a type, not as a fragment on a URL the document is not
    // served from.
    "@type": isPreview ? [`${PROV}Entity`, termIri("PreviewGraph")] : `${PROV}Entity`,
    ...(isPreview && canonicalIri !== undefined ? { canonicalDocument: canonicalIri } : {}),
    repository: stub,
    ...(omitted !== undefined ? { omitted } : {}),
    // No generatedAt (owner rulings 2026-11-06, "QA dates" / "Date source"):
    // `sourceTree` (in commitFields) is what the bytes are a function of.
    ...commitFields,
    ...dependsOnFields,
    counts,
    problems,
    undeclaredTerms: undeclaredTerms(graph, buildContext()),
    undeclaredSchemaModules: [
      ...schemaAudit.undeclared.map((m) => ({ module: m.module, why: "no-tag" as const })),
      ...schemaAudit.reasonless.map((m) => ({ module: m.module, why: "none-without-reason" as const })),
    ],
    "@graph": graph,
  };
}

/**
 * The export's QA sidecar document. Pure — the writer writes it, the judge
 * (`--judge`) only compares it for the advisory line. One rendering of one
 * computation.
 */
export function kgExportQaDocument(data: Awaited<ReturnType<typeof buildExport>>, docPath: string): QaResult {
  return buildQaResult({
    script: "scripts/kg-export.ts",
    scriptAbsPath: join(TOOLS_ROOT, "scripts", "kg-export.ts"),
    // `docPath`, not `${stub}.jsonld`: a foreign layer's document sits at
    // `<stub>/<stub>.jsonld` (bean `dyd3`), so composing it here named a
    // document nothing writes — in the file whose whole purpose is saying
    // what was found about WHICH graph.
    subject: { kind: "graph", id: docPath },
    families: {
      undeclaredTerms: {
        summary:
          "Property names used in `@graph` that the `@context` does not declare. " +
          "Dropped outright by a JSON-LD processor.",
        entries: data.undeclaredTerms,
      },
      undeclaredSchemaModules: {
        summary:
          "Modules in the declared schemas/ directory that do not say what they are, " +
          "so they are absent from the graph.",
        entries: data.undeclaredSchemaModules,
      },
      danglingLinks: {
        summary: "Internal links whose target node is not in `@graph`. A DATA defect, not an export failure.",
        entries: data.danglingLinks,
      },
      problems: {
        summary: "Sources that could not be read. Never empty-by-omission.",
        entries: data.problems,
      },
    },
  });
}

/** What the judge counts, separated so a test can judge a corrupted export without running one. */
export interface KgExportFindings {
  /** Root-level fields absent from the `@context` — a processor drops them. Fatal. */
  rootUndeclared: number;
  /** Nodes carrying a JSON-LD keyword AND its alias. Fatal. */
  collisions: number;
  /** Property names absent from the `@context` (fatal since `ovkk`). */
  undeclaredTerms: number;
  /** Sources that could not be read — the graph is partial, so the question was not fully ASKED. */
  problems: number;
}

/**
 * Bean `bo44`'s four states over an export, with the writer's severity line
 * kept exactly: the three document-validity families fail; dangling links and
 * undeclared schema modules are reported and never fail. An unread source is
 * `unknown` (exit 2) here where the writer has always exited 1 on it — both
 * non-zero, and the judge says WHICH non-zero it is: a partial graph has not
 * been judged whole, which is a different fact from a defect found in it.
 */
export function judgeKgExport(f: KgExportFindings): Judgement {
  return judgementOf({
    failing: f.rootUndeclared + f.collisions + f.undeclaredTerms,
    undetermined: f.problems > 0,
  });
}

/**
 * `--scope <instance|checkout>` — {@link ExportOptions.scope}. Absent is the
 * default (`instance`, the published document); any other value is a usage
 * error rather than a silent default, since the two build different graphs.
 */
function scopeFlag(v: string | undefined): CorpusScope | undefined {
  if (v === undefined || v === "instance" || v === "checkout") return v;
  console.error(`--scope must be \`instance\` or \`checkout\`, not \`${v}\``);
  process.exit(2);
}

if (import.meta.main && process.argv.includes("--judge")) {
  // Judge mode: build the export in memory, judge it, write NOTHING — neither
  // `_kg/<stub>.jsonld` nor the QA sidecar (bean `bo44`). `--out` and
  // `--qa-root` are a writer's flags and are refused here.
  const GATE = "kg:export:judge";
  const argv = process.argv.slice(2);
  const usage = judgeUsage(GATE, argv, ["--judge", "--base-url", "--instance", "--scope"]);
  if (usage !== undefined) process.exit(usage);
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  try {
    // input-site: env KG_BASE_URL #fa804f2f — base URL override for export IRI resolution
    const baseUrl = arg("--base-url") ?? process.env.KG_BASE_URL;
    const instanceRoot = arg("--instance");
    const scope = scopeFlag(arg("--scope"));
    const { stub, docPath } = exportIdentity({ baseUrl, instanceRoot });
    const data = await buildExport({ baseUrl, instanceRoot, scope });
    const published = { ...publishedDocument(data), ...stagingFields() };
    const rootUndeclared = undeclaredRootTerms(published as unknown as Record<string, unknown>, data["@context"]);
    const collisions = keywordCollisions(data["@graph"]);
    for (const t of rootUndeclared) console.error(`  ✗ root field not in the @context: ${t}`);
    for (const c of collisions.slice(0, 10)) console.error(`  ✗ keyword AND alias: ${c}`);
    for (const t of data.undeclaredTerms.slice(0, 10)) console.error(`  ✗ undeclared term: ${t.term}`);
    for (const p of data.problems) console.error(`  ? could not read: ${p}`);
    const hostStub = artefactStub(readDeclaration(ROOT)!);
    const findings: KgExportFindings = {
      rootUndeclared: rootUndeclared.length,
      collisions: collisions.length,
      undeclaredTerms: data.undeclaredTerms.length,
      problems: data.problems.length,
    };
    process.exit(
      concludeJudgement({
        gate: GATE,
        judgement: judgeKgExport(findings),
        detail:
          `${data["@graph"].length} node(s); ${findings.rootUndeclared} root field(s) and ${findings.undeclaredTerms} ` +
          `term(s) undeclared, ${findings.collisions} collision(s), ${findings.problems} unread source(s); ` +
          `${data.danglingLinks.length} dangling link(s) reported, not gated`,
        committed: {
          root: ROOT,
          stem: stub === hostStub ? "kg-export" : `kg-export.${stub}`,
          fresh: kgExportQaDocument(data, docPath),
          writer: instanceRoot ? `kg:export -- --instance ${instanceRoot}` : "kg:export",
        },
      }),
    );
  } catch (e) {
    process.exit(concludeJudgement({ gate: GATE, judgement: "error", detail: (e as Error).message }));
  }
}

// ── `--check` / `--sidecars`: the committed QA sidecars as a verify/write pair
//    (bean `v556`) ──────────────────────────────────────────────────────────
//
// This script writes `qa-results/v1` sidecars under `test/results/`, and until
// `v556` it had no `--check`. So it was in no verify/write pair, `regen`
// ignored it, and `check:artefact-verification` — whose inventory is the
// `--check` scripts in `package.json` — could not contain it. Measured on
// `main` `f4de6c1e20`: two committed sidecars and the script carried THREE
// different hashes; on `cf3e624` the host sidecar had caught up and
// `kg-export.bootstrap.qa-results.json` was still stale (`47109f5daf3d`
// against `e95fab417728`), with every gate green. Its only reader,
// `check:published-instance-exports`, stopped exporting bootstrap through
// this script when the deploy moved bootstrap to `export-graph.ts`, so nothing
// read it at all.
//
// The subjects are DERIVED from what is committed, never listed: the host's
// bare `kg-export` stem, plus every `kg-export.<stub>` sidecar, matched to the
// layer whose declared stub it carries. A committed sidecar no layer
// owns is reported as an ORPHAN — it can be neither checked nor regenerated,
// and that is a finding, not a pass.
//
// Each subject is computed by spawning this script with `--qa-root` pointed at
// a temp directory — the exact command a person runs, as
// `check:published-instance-exports` does — so the comparison is against the
// real producer and not against a second implementation of it.

/** One committed (or expected) kg-export sidecar and the layer it is ABOUT. */
export interface SidecarSubject {
  stem: string;
  /** `--instance` value, absolute; undefined for the host. */
  instance?: string;
}

export function sidecarSubjects(
  dir: string = join(ROOT, QA_RESULTS_DIR),
  roots: string[] = layerRootsIn(checkoutRootFor(ROOT)),
): { subjects: SidecarSubject[]; orphans: string[] } {
  const subjects: SidecarSubject[] = [{ stem: "kg-export" }];
  const orphans: string[] = [];
  const byStub = new Map<string, string>();
  for (const r of roots) {
    try {
      const d = readDeclaration(r);
      if (d) byStub.set(artefactStub(d), r);
    } catch {
      // an unreadable declaration names no stub
    }
  }
  const files = existsSync(dir) ? readdirSync(dir).map(String).sort() : [];
  for (const f of files) {
    const m = /^kg-export\.(.+)\.qa-results\.json$/.exec(f);
    if (!m) continue;
    const inst = byStub.get(m[1]!);
    if (inst === undefined || resolve(inst) === resolve(ROOT)) orphans.push(f);
    else subjects.push({ stem: `kg-export.${m[1]}`, instance: inst });
  }
  return { subjects, orphans };
}

async function sidecarMode(mode: "check" | "write", baseUrl: string | undefined): Promise<number> {
  const { subjects, orphans } = sidecarSubjects();
  // input-site: inert #b05195b2 — scratch directory for sidecar export, removed in finally
  const tmp = mkdtempSync(join(tmpdir(), "kg-export-sidecars-"));
  let bad = 0;
  try {
    for (const s of subjects) {
      const out = join(tmp, s.stem);
      const args = ["run", fileURLToPath(import.meta.url), "--out", join(out, "doc.jsonld"), "--qa-root", out];
      // The host's sidecar describes the PUBLISHED document, so it is built
      // in the scope the deploy builds it in (bean `4ak5` item 2).
      if (s.instance) args.push("--instance", s.instance);
      else args.push("--scope", "instance");
      if (baseUrl) args.push("--base-url", baseUrl);
      // input-site: runs */scripts/kg-export.ts,scripts/kg-export.ts #393d449f — spawns export of each declared instance graph
      spawnSync("bun", args, { cwd: repoRootFor(ROOT), encoding: "utf-8" });
      const fresh = readQaResult(qaResultPath(out, s.stem));
      const label = `${s.stem}.qa-results.json`;
      if (fresh === undefined) {
        bad++;
        console.log(`  ? ${label} — the export wrote no QA result, so currency could not be determined`);
        continue;
      }
      if (mode === "write") {
        writeQaResult(ROOT, s.stem, fresh);
        console.log(`  ✓ ${label} written`);
        continue;
      }
      // COMPUTE AND JUDGE (beans `0dav`, `oqe3`). This compared the fresh
      // result with the committed sidecar, which reads UNKNOWN once the
      // results directory declares `storage` (beans `16ei`/`5hox`): the
      // working copy is no longer the record. Nothing in these sidecars is a
      // finding the gate fails on, so the fresh result is judged and what
      // moved against the baseline is reported; a missing one is UNKNOWN.
      const v = judgeQaResult({
        gate: `kg:export:check (${label})`,
        fresh,
        baseline: { root: ROOT, stem: s.stem, writer: "kg:export:sidecars" },
      });
      if (v.exit !== 0) bad++;
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  for (const o of orphans) {
    bad++;
    console.log(`  ✗ ${o} ORPHAN — no instance in this checkout declares that stub, so nothing can produce or check it`);
  }
  if (bad > 0 && mode === "check") {
    console.log(`\n${bad} kg-export QA sidecar(s) not current. Run \`bun run cat kg:export:sidecars\` and commit.`);
  }
  return bad > 0 ? 1 : 0;
}

/**
 * One JSON-LD document per Tool, written beside the instance document —
 * bean `tdir`.
 *
 * The owner, 2026-10-15: *"i want a seperate jsonld for each Tool w/ its own
 * IRI"* and *"dont externalize the json on main, only when rendered in
 * gh-pages."* So these are BUILD OUTPUT, written where `--out` is (the deploy
 * and `instance-exports.ts` both pass `./_site/<name>/<stub>.jsonld`, the
 * host's included since #603 decision 1b; the default is the gitignored
 * `_kg/` with the same layout), and
 * never committed beside the source: the source of a Tool is its
 * `tools/<id>/<id>.ts`.
 *
 * ## Where, and why that is the IRI
 *
 * `toolIri(docIri, id)` is `<dir of the document IRI>/tools/<id>.jsonld`, and
 * the document is served at `--out`, so `<dir of --out>/tools/<id>.jsonld` is
 * where that IRI resolves. Same relation `instance-exports.ts` uses for
 * `schema/` beside each document. A node whose `@id` is NOT that IRI (a
 * document-relative export has no `/`) is skipped rather than written to a
 * guessed path.
 *
 * ## What is in one
 *
 * The SAME `@context` as the instance document, the Tool node as the single
 * node of its `@graph`, and `partOf` naming the instance document, so a
 * reader holding only the Tool can get back to the graph it came from. The
 * staging stamp is carried over from `published` for the reason it is on the
 * schemas: "which build is this from" is the question with most riding on it.
 *
 * Linking a Tool to its QA sidecar (`kg-qa`, subject kind `tool`) is NOT
 * done here: the sidecars live on the `cat/<instance>/qa-reports` state branch
 * and no step publishes them at a URL a node could name, so a link would be
 * one this site does not serve. That is a follow-up for whichever bean
 * publishes `test/results/kg-qa/tools/<id>.kg-qa.json`.
 *
 * @returns the paths written
 */
export function writeToolDocuments(published: Record<string, unknown>, out: string): string[] {
  const docIri = String(published["@id"]);
  const graph = (published["@graph"] ?? []) as Node[];
  const stamp = Object.fromEntries(
    Object.entries(stagingFields()).filter(([k]) => k in published),
  );
  const written: string[] = [];
  for (const n of graph) {
    if (n["@type"] !== termIri("Tool") || typeof n.name !== "string") continue;
    if (n["@id"] !== toolIri(docIri, n.name) || !String(n["@id"]).includes("/")) continue;
    const file = join(dirname(out), toolDocumentPath(n.name));
    mkdirSync(dirname(file), { recursive: true });
    const doc = {
      "@context": published["@context"],
      "@id": n["@id"],
      partOf: docIri,
      ...stamp,
      "@graph": [n],
    };
    writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
    written.push(file);
  }
  return written;
}

/**
 * One small document AND one page per subject, written beside the layer
 * document — what makes a slash-path `@id` load (litlfred/cat-harness-tools#603).
 *
 * `makeIri` mints `<doc dir>/<kind>/<id>`; a path nothing serves is the 404
 * `makeIri`'s own history warns about, so minting and serving land together.
 * The same relation as {@link writeToolDocuments}: the document is served at
 * `--out`, so `<dir of --out>/<kind>/<id>.*` is where the IRI resolves.
 *
 * - `<kind>/<id>.jsonld` — `partOf` the instance document, and the subject
 *   as the first node of `@graph`. A process's document also holds its flows,
 *   which are fragments of its page (`process/P#flow/F`). Its `@context` is
 *   the instance document's, published ONCE beside it as
 *   `<stub>.context.jsonld` and named by IRI: inlined, its ~13 KB was most of
 *   every subject's bytes (67 MB for cat-harness's ~1,700 subjects, measured
 *   2026-10-23).
 * - `<kind>/<id>.html` — a small page carrying the same JSON-LD in a
 *   `<script type="application/ld+json">`, with `<link rel="alternate">` to
 *   the `.jsonld`. GitHub Pages serves `<id>.html` at the extensionless path,
 *   which is the subject IRI itself (checked on the live site 2026-10-23).
 * - `<kind>/<id>/index.html` too when the subject has subjects UNDER it (a
 *   process: `process/P/node/T`), so the bare path loads whether the host
 *   prefers the file or the directory.
 *
 * Build output, like the Tool documents: never committed.
 *
 * ## A COPY, when the document is served somewhere its IRI does not name
 *
 * A layer with its own `canonicalUrl` (the DAK layer:
 * `http://smart.who.int/base`) mints its subjects there, and that site serves
 * none of them. Owner, 2026-10-29 (litlfred/cat-harness-tools#638, option B):
 * publish a copy on THIS site and link it to the canonical IRI with
 * `owl:sameAs`. So when `servedDocIri` (where `--out` is served) sits in
 * another directory than the document's `@id`, each subject document is
 * named by where it is served, is `partOf` the served document, and is
 * `sameAs` its canonical subject document. Its `@context` is the copy beside
 * it, which loads. The nodes inside keep their canonical `@id`s: the
 * canonical address stays the identity.
 *
 * ## A link to the diagram
 *
 * `diagrams` maps a process IRI to its diagram page (`lib/diagram-pages.ts`).
 * A process's page, and each of its steps' and lanes' pages, link to it
 * (owner's 3a on #620, 2026-10-23, done in #638). No entry, no link.
 *
 * @returns the paths written
 */
export function writeSubjectDocuments(
  published: Record<string, unknown>,
  out: string,
  servedDocIri?: string,
  diagrams: ReadonlyMap<string, string> = new Map(),
  sourceRoots: readonly string[] = [],
  /** Extra HTML for a subject's page, by its `@id` (a Schema node's description and fields). */
  extras: ReadonlyMap<string, string> = new Map(),
): string[] {
  const docIri = String(published["@id"]);
  // The provenance footer (owner, 2026-11-05, "2B"): a subject whose node
  // names its `sourcePath` (a process's `.bpmn`) shows the log beside it. The
  // path is relative to the layer, or to the repository; the first root
  // that holds the file answers.
  const provenanceOf = (n: Node): string => {
    const rel = typeof n.sourcePath === "string" ? n.sourcePath : undefined;
    if (rel === undefined) return "";
    const abs = sourceRoots.map((r) => join(r, rel)).find((f) => existsSync(f));
    return abs === undefined ? "" : provenanceSectionFor(abs, { liquid: false });
  };
  const copyBase = servedDocIri !== undefined && subjectBase(servedDocIri) !== subjectBase(docIri) ? subjectBase(servedDocIri) : undefined;
  const graph = (published["@graph"] ?? []) as Node[];
  const stamp = Object.fromEntries(Object.entries(stagingFields()).filter(([k]) => k in published));
  // A flow's `<process>#flow/F` belongs on its process's page.
  const fragmentsOf = new Map<string, Node[]>();
  const subjects: Array<{ node: Node; stem: string }> = [];
  for (const n of graph) {
    const id = String(n["@id"]);
    // A node with no `@type` is not a subject; it has no page.
    if (n["@type"] === undefined) continue;
    const stem = subjectFileStem(id, docIri);
    if (stem !== undefined) {
      subjects.push({ node: n, stem });
      continue;
    }
    const hash = id.indexOf("#");
    if (hash !== -1 && subjectPathOf(id, docIri) !== undefined) {
      const owner = id.slice(0, hash);
      fragmentsOf.set(owner, [...(fragmentsOf.get(owner) ?? []), n]);
    }
  }
  // Every `<kind>/<id>` with a subject path under it (`process/P` under `process/P/node/T`).
  const parentStems = new Set<string>();
  for (const { stem } of subjects) {
    const parts = stem.split("/");
    for (let i = 2; i < parts.length; i++) parentStems.add(parts.slice(0, i).join("/"));
  }
  const dir = dirname(out);
  const written: string[] = [];
  if (subjects.length === 0) return written;
  const contextFile = out.replace(/\.jsonld$/, "") + ".context.jsonld";
  mkdirSync(dir, { recursive: true });
  writeFileSync(contextFile, JSON.stringify({ "@context": published["@context"] }, null, 2) + "\n");
  written.push(contextFile);
  const contextName = basename(contextFile);
  const labels = subjectLabels(graph);
  for (const { node, stem } of subjects) {
    const id = String(node["@id"]);
    const name = stem.split("/").pop()!;
    const doc = {
      // Absolute where the document is; relative to the subject's file otherwise.
      "@context":
        copyBase !== undefined
          ? `${copyBase}${contextName}`
          : /^https?:\/\//.test(docIri)
            ? `${subjectBase(docIri)}${contextName}`
            : `${"../".repeat(stem.split("/").length - 1)}${contextName}`,
      ...(copyBase !== undefined
        ? { "@id": `${copyBase}${stem}.jsonld`, partOf: servedDocIri, sameAs: `${id}.jsonld` }
        : { "@id": `${id}.jsonld`, partOf: docIri }),
      ...stamp,
      "@graph": [node, ...(fragmentsOf.get(id) ?? [])],
    };
    const pageDoc = copyBase !== undefined ? servedDocIri! : docIri;
    const proc = owningProcess(id, stem);
    const diagram = proc === undefined ? undefined : diagrams.get(proc);
    const file = join(dir, `${stem}.jsonld`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
    written.push(file);
    // The page embeds the document WITHOUT the staging stamp (bean g196,
    // owner 2026-11-01, Q-S1-1 A). A preview's banner already names its build
    // from `staging.json`, and a stamp in every page made each rebuild of one
    // preview rewrite every subject page. The `.jsonld` above keeps it: data
    // has no banner, so it says in-band which build it came from.
    const pageView = Object.fromEntries(Object.entries(doc).filter(([k]) => !(k in stamp)));
    const page = join(dir, `${stem}.html`);
    const provenance = provenanceOf(node);
    writeFileSync(page, subjectPage(pageView, node, fragmentsOf.get(id) ?? [], `${name}.jsonld`, pageDoc, diagram, labels, provenance, extras.get(id) ?? ""));
    written.push(page);
    if (parentStems.has(stem)) {
      const index = join(dir, stem, "index.html");
      mkdirSync(dirname(index), { recursive: true });
      writeFileSync(index, subjectPage(pageView, node, fragmentsOf.get(id) ?? [], `../${name}.jsonld`, pageDoc, diagram, labels, provenance, extras.get(id) ?? ""));
      written.push(index);
    }
  }
  return written;
}

const escHtml = (v: unknown): string =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * A literal's text, escaped, with its Markdown code spans drawn as `<code>`.
 *
 * Declaration descriptions are written in Markdown, so a placeholder such as
 * `` `<doc-id>.<section>.<n>` `` sits in a code span. Escaped and left as
 * text, the backticks showed and `&lt;section&gt;` read as a block tag leaked
 * into the page, which `check:escaped-markup` rightly refused on a declared
 * directory's subject page (2026-11-15). Only code spans are drawn: the rest
 * of the literal stays escaped text.
 */
export function literalHtml(s: string): string {
  return s
    .split(/(`[^`\n]+`)/)
    .map((part) => (/^`[^`\n]+`$/.test(part) ? `<code>${escHtml(part.slice(1, -1))}</code>` : escHtml(part)))
    .join("");
}

/**
 * A value as HTML: an IRI is a link, a list is each of its items.
 *
 * An IRI naming another node of the same graph is shown by that node's NAME,
 * with the IRI under it (owner, 2026-10-31, on a lane's page: "where is link
 * to …/process/Process_ContributorFeedback"). The bare IRI was the link text,
 * one unbreakable line wider than the column, so the parent process ran off
 * the page. The IRI still wraps, and is still the address.
 */
function valueHtml(v: unknown, labels: ReadonlyMap<string, string> = new Map()): string {
  if (Array.isArray(v)) return v.map((x) => valueHtml(x, labels)).join("<br>");
  if (v !== null && typeof v === "object") {
    const id = (v as Record<string, unknown>)["@id"];
    return typeof id === "string" ? valueHtml(id, labels) : `<code>${escHtml(JSON.stringify(v))}</code>`;
  }
  const s = String(v);
  if (!/^https?:\/\//.test(s)) return literalHtml(s);
  const label = labels.get(s);
  return label === undefined
    ? `<a class="iri" href="${escHtml(s)}">${escHtml(s)}</a>`
    : `<a href="${escHtml(s)}">${escHtml(label)}</a><br><span class="iri muted">${escHtml(s)}</span>`;
}

/** Every typed node's display name, by IRI: its title, else its name. */
export function subjectLabels(graph: readonly Node[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const n of graph) {
    const id = n["@id"];
    const label = n.title ?? n.name;
    if (typeof id === "string" && n["@type"] !== undefined && typeof label === "string" && label !== "") labels.set(id, label);
  }
  return labels;
}

/**
 * A subject page is excluded from the site search ON PURPOSE (fa#2683).
 *
 * There is one per graph node (about 3,000 on the folio-assistant site), and
 * each repeats data a human page already carries: the skill, process or
 * schema page that Jekyll indexes. They are written after Jekyll, so the
 * theme's index never held them. But `rail-standalone-pages` gives them the
 * theme's search box, and `publish-verify`'s `search-index` check counted
 * them as pages the index failed to cover. That dropped coverage below its
 * floor and refused every publish. The marker is the one `head_custom.html`
 * writes for `search_exclude: true` (`SEARCH_EXCLUDE_MARKER` in
 * `publish-verify.ts`), so the check counts these pages as excluded, and
 * says how many, rather than as missing.
 */
/**
 * The page's dark colours, behind the site's light/dark switch (`darkRules`,
 * issue #2208) rather than the OS alone. Owner, 2026-10-31, on a lane's page:
 * "where is light/dark mode? looks bad" — the content followed the OS (dark)
 * while the rail and bar beside it followed the site (light).
 */
const SUBJECT_DARK = darkRules(":root { --fg: #f5f5f7; --bg: #1c1c1e; --muted: #a1a1a6; --line: #3a3a3c; }");

const SUBJECT_SEARCH_EXCLUDE = '<meta name="fa-search-exclude" content="true">';

const SUBJECT_NODE_KIND: Readonly<Record<string, string>> = {
  skill: "skills",
  translationSource: "translation-sources",
  process: "processes",
  globalTask: "processes",
  decision: "processes",
  softwareLibrary: "software-library",
  actor: "scenarios",
  role: "scenarios",
  capability: "scenarios",
  theme: "themes",
  schema: "schemas",
  convention: "schemas",
  externalSchema: "external-schema",
  "glossary-usage": "swimlane-glossary",
  requirement: "requirements",
  directory: "cat-harness",
  asset: "cat-harness",
  package: "skills",
  voice: "voices",
};

/**
 * The readable section of each Schema node's page: its module's description
 * and a fields table per public `*Schema` export (`scripts/lib/schema-page.ts`).
 *
 * The exports are rendered by the publisher's own `renderZodSchemas`, so the
 * table and the published `zod/` file are one rendering. A module that fails
 * to import still gets its description; the scan's problems are the deploy's
 * Zod gate's to report, not this page's.
 */
export async function schemaPageExtras(published: Record<string, unknown>, instanceRoot?: string): Promise<Map<string, string>> {
  const nodes = ((published["@graph"] ?? []) as Node[]).filter(
    (n): n is Node & { "@id": string; module: string } => n["@type"] === termIri("Schema") && typeof n.module === "string",
  );
  if (nodes.length === 0) return new Map();
  // declared-path-literal: a probe for which layer implements the harness, as `collectSchemas` makes it.
  const root = instanceRoot !== undefined ? resolve(instanceRoot) : implementingRootFor(ROOT, "schemas/kg/cat-harness.ts");
  const scan = await scanInstanceZodSchemas(root);
  const { rendered } = renderZodSchemas(scan.found, "");
  const linked = new Set(nodes.filter((n) => Array.isArray(n.jsonSchema) && n.jsonSchema.length > 0).map((n) => n.module));
  const details = schemaPageDetails(
    root,
    nodes,
    rendered.map((r) => ({
      module: r.module,
      exportName: r.exportName,
      schema: r.schema,
      // The page sits in `<stub>/schema/`, beside the `zod/` the layer publishes.
      ...(linked.has(r.module) ? { href: r.published } : {}),
    })),
  );
  return new Map([...details].map(([id, d]) => [id, schemaSectionHtml(d)]));
}

/**
 * One subject's page: its fields, its flows (each at the `id` its fragment
 * names, so `…/process/P#flow/F` lands on it), and the same JSON-LD as the
 * `.jsonld` beside it, embedded. Self-contained: no script, no stylesheet.
 */
export function subjectPage(
  doc: Record<string, unknown>,
  node: Node,
  fragments: readonly Node[],
  jsonldHref: string,
  docIri: string,
  diagram?: string,
  labels: ReadonlyMap<string, string> = new Map(),
  provenance = "",
  extra = "",
): string {
  const id = String(node["@id"]);
  const title = String(node.title ?? node.name ?? id.split("/").pop());
  const type = stripNamespace(String(node["@type"]));
  const pathKind = (subjectPathOf(id, docIri) ?? id).split("/").find((seg) => seg in SUBJECT_NODE_KIND) ?? "";
  const nodeKind = SUBJECT_NODE_KIND[pathKind] ?? "skills";
  const pageHref = jsonldHref.replace(/\.jsonld$/, ".html");
  const graphName = docIri.split("/").pop()!.replace(/\.jsonld$/, "");
  // The node this one is part of (a lane's or a step's process), named at the top.
  const parent = typeof node.partOf === "string" && /^https?:\/\//.test(node.partOf) ? node.partOf : undefined;
  const rows = (n: Node): string =>
    Object.entries(n)
      .filter(([k]) => k !== "@id" && k !== "@type")
      .map(([k, v]) => `<tr><th>${escHtml(k)}</th><td>${valueHtml(v, labels)}</td></tr>`)
      .join("\n");
  const flows = fragments
    .map((f) => {
      const fid = String(f["@id"]);
      const anchor = fid.slice(fid.indexOf("#") + 1);
      return `<section id="${escHtml(anchor)}"><h3>${escHtml(anchor)}</h3><table class="fa-page-wide">${rows(f)}</table></section>`;
    })
    .join("\n");
  // `<` escaped so no value can close the script element early.
  const json = JSON.stringify(doc).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${SUBJECT_SEARCH_EXCLUDE}
<title>${escHtml(title)} · ${escHtml(type)}</title>
<link rel="alternate" type="application/ld+json" href="${escHtml(jsonldHref)}">
<script type="application/ld+json">
${json}
</script>
<style>
:root { color-scheme: light dark; --fg: #1d1d1f; --bg: #fff; --muted: #6e6e73; --line: #d2d2d7; }
${SUBJECT_DARK}
body { margin: 0; font: 15px/1.5 system-ui, sans-serif; color: var(--fa-pl-fg, var(--fg)); background: var(--fa-pl-bg, var(--bg)); }
.fa-page-main { box-sizing: border-box; padding: 1rem 1.5rem 3rem; max-width: 72rem; overflow-wrap: anywhere; }
code, .iri { font-family: var(--fa-font-mono,Menlo,Consolas,monospace); font-size: 0.9em; overflow-wrap: anywhere; word-break: break-word; }
.muted { color: var(--fa-pl-muted, var(--muted)); }
.fa-page-main .subject-kind { margin: 0; }
.fa-page-main h1 { margin-top: 0.25rem; }
.subject-pin { margin-left: 0.35rem; padding: 0.1rem 0.5rem; font: inherit; font-size: 0.85em; border: 1px solid var(--fa-pl-line, var(--line)); border-radius: 999px; background: transparent; color: inherit; cursor: pointer; }
.subject-pin[aria-pressed="true"] { border-color: #2e7d32; background: #2e7d32; color: #fff; }
table { border-collapse: collapse; width: 100%; margin: 0.5rem 0 1.5rem; table-layout: fixed; }
th, td { text-align: left; vertical-align: top; padding: 0.3rem 0.5rem; border-top: 1px solid var(--fa-pl-line, var(--line)); overflow-wrap: anywhere; }
th { width: 10rem; font-weight: 600; }
.schema-fields th, .schema-fields td { width: auto; }
.schema-prose pre { overflow-x: auto; padding: 0.5rem; border: 1px solid var(--fa-pl-line, var(--line)); }
td .iri { font-size: 0.8em; }
@media (max-width: 40rem) { th { width: 6.5rem; } }${provenance === "" ? "" : PROVENANCE_INLINE_STYLE}
</style>
</head>
<body>
<main class="fa-page-main">
<p class="muted subject-kind">${escHtml(type)}</p>
<h1>${escHtml(title)}</h1>
${parent === undefined ? "" : `<p>Part of <a href="${escHtml(parent)}">${escHtml(labels.get(parent) ?? parent.split("/").pop()!)}</a></p>\n`}<p class="iri muted">${escHtml(id)}</p>
<p data-fa-pin="${escHtml(id)}" data-fa-pin-kind="pin" data-fa-pin-node-kind="${escHtml(nodeKind)}" data-fa-pin-title="${escHtml(title)}" data-fa-pin-href="${escHtml(pageHref)}" data-fa-pin-source="${escHtml(graphName)}"><a href="${escHtml(jsonldHref)}">JSON-LD</a>${diagram === undefined ? "" : ` · <a href="${escHtml(diagram)}">diagram</a>`} · in graph <a class="iri" href="${escHtml(docIri)}">${escHtml(docIri.split("/").pop()!)}</a> · <button type="button" class="subject-pin" data-fa-pin-control aria-pressed="false" aria-label="Pin ${escHtml(title)} to your folio glass" title="Pin to your folio">&#x1f4cc; Pin to folio</button></p>${
    typeof doc.sameAs === "string" ? `\n<p class="muted">A copy published here. The canonical address is <span class="iri">${escHtml(id)}</span> (<code>owl:sameAs</code>).</p>` : ""
  }
<table class="fa-page-wide">
${rows(node)}
</table>
${extra === "" ? "" : `${extra}\n`}${flows === "" ? "" : `<h2>Flows</h2>\n${flows}`}
${provenance}</main>
</body>
</html>
`;
}

if (import.meta.main) {
  const arg = (flag: string): string | undefined => {
    const i = process.argv.indexOf(flag);
    return i !== -1 ? process.argv[i + 1] : undefined;
  };
  // input-site: env KG_BASE_URL #fa804f2f — base URL override for export IRI resolution
  const baseUrl = arg("--base-url") ?? process.env.KG_BASE_URL;
  // `--instance <root>` exports ANOTHER declared layer's graph — its
  // identity and its generic collectors, never this one's content under its
  // name. Added because `pve3`'s "neither" ruling makes a sibling's graph a
  // document the root's own graph LINKS TO, and a link that names a document
  // nothing publishes is a 404 with a `@id` in front of it.
  const instanceRoot = arg("--instance");
  // ── `--qa-root <dir>` — where the COMMITTED QA sidecar goes (bean `ymsu`) ──
  //
  // This script writes two things: the JSON-LD document, whose destination
  // `--out` has always governed, and a QA sidecar under
  // `<root>/test/results/`, whose destination nothing did. So a caller that
  // only wants the computation — and both callers below are exactly that —
  // pointed `--out` at a temp directory and still wrote a tracked file into
  // the tree it was about to judge.
  //
  // Measured on `origin/main` `e718627f198`, one gate at a time, with
  // `producer.script_hash` hand-staled to `deadbeefdead`:
  //
  //   check:version-bump                  exit 0, hash REPAIRED to 0456470f68c8
  //   check:published-instance-exports    exit 0, hash REPAIRED to 0456470f68c8
  //
  // A gate that repairs its own subject cannot fail on it, and it takes the
  // evidence with it. Worse on that same tree, `kg-export.bootstrap.qa-results
  // .json` was ALREADY stale at `b539167517cb` — so `main` was carrying a wrong
  // recorded hash that no verdict reported, only the runner's mutation guard.
  //
  // The flag is explicit rather than an environment variable, and a directory
  // rather than a boolean, because that is the pattern this repository already
  // has: `pipeline/profile-conformance-axis.test.ts` builds its root
  // with `mkdtempSync` and passes it in. A second mechanism for "compute
  // somewhere else" would be a second answer to one question.
  //
  // It defaults to `ROOT`, so `bun run cat kg:export` and the deploy are unchanged:
  // the producer still writes the committed sidecar, and only a caller that
  // says otherwise gets a different destination.
  const qaRoot = arg("--qa-root") ?? ROOT;
  // `--scope` — see {@link ExportOptions.scope}. The deploy says `instance`
  // aloud although it is the default, so the published document's scope is
  // read off the workflow rather than off this file (bean `4ak5` item 2).
  const scope = scopeFlag(arg("--scope"));
  // Bean `v556` — see `sidecarMode`. Neither writes the JSON-LD document.
  if (process.argv.includes("--check") || process.argv.includes("--sidecars")) {
    process.exit(await sidecarMode(process.argv.includes("--check") ? "check" : "write", baseUrl));
  }
  const { stub, docPath, legacyDocPath } = exportIdentity({ baseUrl, instanceRoot });
  // Named after the repository, per the stub convention — `<stub>.jsonld`,
  // never a generic `kg.json`. `.jsonld` because it IS JSON-LD; the extension
  // is what tells a fetcher to treat it as one.
  // `_kg/` is a REPOSITORY build output — gitignored at the repository root,
  // beside `node_modules/`, `_site/` and `test-results/`, and read from there
  // by the e2e specs and `test-server.mjs`, both of which run at that root.
  // `ROOT` became the LAYER root with the move (bean `wggr`), so this
  // default started writing `cat-harness/_kg/` while every reader still looked
  // one level up — and the stale pre-move copy at the old path made it look
  // fine locally.
  // input-site: inert #a5ea3460 — default export destination, an output path this script writes, never reads
  // `_kg/` stands for the site root, so the document sits at its published
  // path under it, `<name>/<stub>.jsonld` (#603 decision 1b).
  const asked = arg("--out") ?? join(repoRootFor(ROOT), "_kg", docPath);
  // A deploy step still naming the old root path is read as naming the same
  // site (#603 decision 1b), so the index's workflows and this layer can be
  // re-pinned in either order. See `placedOut`.
  const { out, moved: outMoved } = placedOut(asked, docPath, legacyDocPath);
  if (outMoved) console.log(`--out ${asked} is the old root address; writing the document at its published path, ${out}`);
  const data = await buildExport({ baseUrl, instanceRoot, scope });

  mkdirSync(dirname(out), { recursive: true });
  // The staging stamp, from the same function `harness-schema-export` uses, so
  // the two documents a build publishes side by side cannot disagree about
  // which build they came from. It was an inline `bun -e` in
  // `feature-staging.yml` that reached this document and nothing else.
  // The PROJECTION, not the computation — the QA findings are written to
  // `test/results/` below instead. See `publishedDocument`.
  const published = { ...publishedDocument(data), ...stagingFields() };
  writeFileSync(out, JSON.stringify(published, null, 2) + "\n");
  const toolDocs = writeToolDocuments(published, out);
  // `--served-at <url>`: where `--out` is served, when that is not its `@id`
  // (an own-canonical layer published on this site, #638). Its subject
  // documents are then copies named by where they are served.
  const servedAt = arg("--served-at");
  const subjectDocs = writeSubjectDocuments(
    published,
    out,
    servedAt,
    diagramPages(published),
    [instanceRoot ?? ROOT, repoRootFor(ROOT)],
    await schemaPageExtras(published, instanceRoot),
  );

  console.log(`KG export → ${relative(ROOT, out)}\n  @id  ${data["@id"]}`);
  if (toolDocs.length > 0) console.log(`  + ${toolDocs.length} Tool document(s) → ${relative(ROOT, join(dirname(out), "tools"))}/`);
  if (subjectDocs.length > 0) console.log(`  + ${subjectDocs.length} subject file(s) (.jsonld and .html) → ${relative(ROOT, dirname(out)) || "."}/<kind>/`);
  for (const [t, n] of Object.entries(data.counts).sort()) console.log(`  ${String(n).padStart(5)}  ${t}`);
  console.log(`  ${String(data["@graph"].length).padStart(5)}  total`);

  // A keyword collision is a DOCUMENT-VALIDITY failure, not an unread source,
  // so it is not in `problems` — but it is fatal for the same reason they are:
  // a graph whose nodes offer two answers for their own identity must not be
  // published as a whole one. Checked here against the assembled graph rather
  // than trusted from the collectors.
  // The DOCUMENT ROOT, which `undeclaredTerms` below cannot see — see
  // `undeclaredRootTerms`. Checked before the graph-level report because a
  // root field that vanishes takes the provenance and the counts with it.
  const rootUndeclared = undeclaredRootTerms(published as unknown as Record<string, unknown>, data["@context"]);
  if (rootUndeclared.length > 0) {
    console.error(`\n${rootUndeclared.length} root-level field(s) are NOT in the @context, so a JSON-LD processor drops them:`);
    for (const t of rootUndeclared) console.error(`  \u2717 ${t}`);
    console.error("  Declare each in `buildContext` — see the DOCUMENT ROOT section there.");
    process.exit(1);
  }

  // The QA RESULT, under the declared `test/results/`.
  //
  // The owner's rule, 2026-09-19: an artefact generated primarily as a QA
  // reviewer belongs there as part of a QA process — placement follows
  // PROVENANCE, not file family. These four findings are exactly that: a
  // review of the graph this run just produced.
  //
  // Written from the SAME values the document carries, not recomputed. Two
  // renderings of one computation cannot disagree; two computations can. It is
  // the rule `feature-staging.yml` already follows when it copies the `.json`
  // alias AFTER the staging stamp, and the reason `stagingStamp` is one
  // function rather than one per exporter.
  //
  // The document still carries these fields. Moving them out is a SEPARATE
  // change, because `scripts/kg-viewer.ts:573` reads `doc.undeclaredTerms` off
  // the published document and renders it — so removing them needs the viewer
  // pointed at the published result first, and a half-moved field would take
  // the viewer's panel with it.
  // ── ONE SIDECAR PER SUBJECT, because the stem is the only thing keeping
  //    two layers' findings apart ─────────────────────────────────────
  //
  // The stem was the constant `"kg-export"`, so EVERY layer's export wrote
  // the same committed file and the last writer won. Measured 2026-09-21: one
  // `--instance ./bootstrap` run replaced this layer's committed result
  // wholesale — `subject.id` flipped from `cat-harness.jsonld` to
  // `bootstrap.jsonld` and the findings with it, in a file whose whole
  // purpose is saying what was found about WHICH graph.
  //
  // Invisible while one document was ever built, and it stayed invisible in CI
  // because the deploy does not commit the sidecar. It surfaced the moment a
  // gate ran the deploy's own commands from a checkout.
  //
  // Same rule the `kg-qa` tree already follows — a sidecar mirrors its
  // subject's path "because flat would collide". The HOST keeps the bare stem
  // so its committed path is unchanged; a foreign layer is qualified by its
  // own stub.
  const hostStub = artefactStub(readDeclaration(ROOT)!);
  const qaStem = stub === hostStub ? "kg-export" : `kg-export.${stub}`;
  const resultPath = writeQaResult(qaRoot, qaStem, kgExportQaDocument(data, docPath));
  // Relative to the root it was WRITTEN under, not to `ROOT`. With `--qa-root`
  // pointing elsewhere the latter prints a pile of `../`, and a reader chasing
  // a sidecar has to resolve it by hand to find out it is in a temp directory.
  console.log(`QA result → ${relative(qaRoot, resultPath)}`);

  const collisions = keywordCollisions(data["@graph"]);
  if (collisions.length > 0) {
    console.error(`\n${collisions.length} node(s) carry a JSON-LD keyword AND its alias:`);
    for (const c of collisions.slice(0, 10)) console.error(`  \u2717 ${c}`);
    if (collisions.length > 10) console.error(`  \u2026 and ${collisions.length - 10} more`);
    process.exit(1);
  }

  if (data.undeclaredSchemaModules.length > 0) {
    console.warn(
      `\n${data.undeclaredSchemaModules.length} module(s) in the declared schemas/ directory ` +
        `do not declare what they are — they are absent from the graph:`,
    );
    for (const m of data.undeclaredSchemaModules) console.warn(`  · ${m.module}  (${m.why})`);
    console.warn("  Add `@graphNode schema` or `@graphNode none — <reason>` to the leading docblock.");
  }

  // FATAL since bean `ovkk` drove the count to zero — see `undeclaredTerms`.
  // Not reported-and-continued like `danglingLinks`, which are data defects
  // this tool cannot fix; an undeclared term is a defect in this tool, and the
  // decision it demands is one line away.
  //
  // Reported here but exited on BELOW, so a run that is also missing sources
  // prints both rather than stopping at the first.
  let undeclaredFatal = false;
  if (data.undeclaredTerms.length > 0) {
    undeclaredFatal = true;
    const n = data.undeclaredTerms.reduce((a, t) => a + t.occurrences, 0);
    console.error(
      `\n${data.undeclaredTerms.length} property name(s), ${n} occurrence(s), are NOT in the @context ` +
        `\u2014 a JSON-LD processor drops every one:`,
    );
    for (const t of data.undeclaredTerms.slice(0, 8)) {
      console.error(`  \u2717 ${t.term.padEnd(22)} ${String(t.occurrences).padStart(4)}\u00d7  on ${t.onTypes.join(", ")}`);
    }
    if (data.undeclaredTerms.length > 8) console.error(`  \u2717 \u2026 and ${data.undeclaredTerms.length - 8} more`);
    console.error(
      "\nEach one needs a DECISION, not a line: does it deserve a predicate IRI,\n" +
        "and is it a LINK (`{\"@type\": \"@id\"}`, value minted with `makeIri`) or a\n" +
        "literal? A wrong coercion is worse than the gap -- a bare name under\n" +
        "`@id` resolves against the document base and mints an IRI nobody chose.\n" +
        "If a link already in the graph carries the same fact, REMOVE the property\n" +
        "instead of declaring it. Add it to `buildContext()` when it stays.",
    );
  }

  if (data.danglingLinks.length > 0) {
    console.warn(`\n${data.danglingLinks.length} dangling internal link(s) — reported, not fatal:`);
    for (const d of data.danglingLinks) console.warn(`  · ${d.edge} → ${subjectPathOf(d.to, data["@id"]) ?? d.to}`);
  }

  if (data.problems.length > 0) {
    console.error(`\n${data.problems.length} source(s) could not be read:`);
    for (const p of data.problems) console.error(`  ✗ ${p}`);
    // Reported, and non-zero: a partial graph must not pass for a whole one.
    process.exit(1);
  }

  if (undeclaredFatal) process.exit(1);
}
