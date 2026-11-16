/**
 * The ONE file in this layer that names where the platform lives.
 *
 * smart-base is staged here ahead of becoming its own repository
 * (`litlfred/smart-base`, plan `smart-separation-2026-10-01`, issue #1767,
 * bean `n3ni`). Every platform symbol the layer uses is re-exported from
 * here, so the day it leaves, re-pointing the platform is a one-file edit —
 * the same reason a folio's block manifests import `../schemas/builders`
 * and never folio-assistant directly. `instance-separation-imports.test.ts`
 * holds the rule: no other file here may reach outside the layer.
 *
 * The one split is `./schema.ts`, re-exported first below: the symbols of
 * the files the platform loads by glob (`themes/`, `schemas/`,
 * `pipeline/qa-checkers-*`), kept apart so those files do not carry this
 * barrel's IG-site imports into every check that loads them. The platform's
 * location is still named in this directory only.
 *
 * Grouped by the platform module each symbol comes from; a module that
 * moves is one line to change. Includes one test-support export
 * (`writeInstanceConfig`), because a test in this layer uses it.
 *
 * @module smart-base/platform
 */
export * from "./schema.js";
export {
  declarationPathIn,
  directoriesForGraph,
  instanceDirectoryForGraph,
  instanceRootsIn,
  layerRootsIn,
  readDeclaration,
  repoRootFor,
} from "../../cat-harness-tools/schemas/kg/cat-harness.js";
export { isBuiltAtPublish } from "../../cat-harness-tools/schemas/kg/built-at-publish.js";
// `overlayPath` (sm8r) through a namespace import, not a named re-export: a
// composition that still pins a cat-harness-tools without it (folio-assistant
// main) must keep loading this shim. There no writer puts anything at the
// output root, so reading the path as given is the right answer.
import * as layerOutput from "../../cat-harness-tools/scripts/lib/layer-output.js";
export const overlayPath: (abs: string, root?: string) => string =
  (layerOutput as { overlayPath?: (abs: string, root?: string) => string }).overlayPath ?? ((abs: string) => abs);
export {
  ContentTypeConflictError,
  describeRepository,
} from "../../cat-harness-tools/schemas/content/content-type.js";
export {
  registerBaseContentTypes,
} from "../../cat-harness-tools/schemas/content/content-types-base.js";
export {
  DocumentKindSchema,
  DOCUMENT_KIND_COVERAGE_SCHEMA_TAG,
  DOCUMENT_KIND_SCHEMA_TAG,
  DocumentKindCoverageSchema,
  type DocumentKind,
  type DocumentKindCoverage,
} from "../../cat-harness-tools/schemas/content/document-kind.js";
export {
  ExternalSchemaSchema,
} from "../../cat-harness-tools/schemas/kg/external-schema.js";
export {
  describeRepositoryClosure,
} from "../../cat-harness-tools/schemas/kg/harness-config.js";
export {
  PINNED_TERMINOLOGY_TAG,
  PinnedTerminologySchema,
  type PinnedConcept,
  type PinnedTerminologyFile,
} from "../../cat-harness-tools/schemas/content/pinned-terminology.js";
export {
  instanceThemes,
  instanceWebpageThemes,
} from "../../cat-harness-tools/schemas/ui/theme-by-ref.js";
export { defineTool, type ToolDefinition } from "../../cat-harness-tools/schemas/tools/tool.js";
export { toolTypeIri } from "../../cat-harness-tools/schemas/tools/tool-types.js";
export { toolFactory, toolsFromFolders } from "../../cat-harness-tools/schemas/tools/tool-folders.js";
export {
  writeInstanceConfig,
} from "../../cat-harness-tools/test/support/instance-fixture.js";
export {
  QA_CRITERIA_REGISTRY,
} from "../../cat-harness-tools/pipeline/qa-criteria-registry.js";
export {
  readBlockManifest,
} from "../../cat-harness-tools/pipeline/qa-utils.js";
export {
  BLOCK_KINDS,
  CONTENT_PROFILES,
  kindForBuilder,
  adapterForKind,
  profileAcceptsKind,
} from "../../cat-harness-tools/schemas/content/block-kinds.js";
export {
  criterionAdapters,
  incompatibleCompanions,
  COMPANION_ROLES,
  type CompanionRole,
} from "../../cat-harness-tools/schemas/sdlc/block-qa.js";
export {
  siteDirFor,
} from "../../cat-harness-tools/schemas/kg/cat-harness.js";
export {
  KNOWN_LABEL_PREFIXES,
} from "../../cat-harness-tools/schemas/constraints.js";
export {
  ContributionRegistry,
  composedKindOwner,
} from "../../cat-harness-tools/schemas/content/contributions.js";
export {
  pagesOf,
  readStructure,
  STRUCTURE_FILENAME,
  type BaseSection,
  type BaseStructure,
} from "../../cat-harness-tools/schemas/content/document-structure.js";
export {
  assertPrefixesInSync,
  typesForKind,
} from "../../cat-harness-tools/schemas/kg/jsonld.js";
export {
  igSiteData,
} from "../../fhir-harness/scripts/ig-site-data.js";
export {
  loadContributionsSync,
} from "../../cat-harness-tools/schemas/kg/harness-config.js";
export {
  siteFilter,
} from "../../cat-harness-tools/scripts/staging-cone.ts";
export {
  AST_SITE_WRITERS,
} from "../../fhir-harness/scripts/stage-ast-sites.ts";
export {
  handleFromUrl,
} from "../../folio-assistant-core/schemas/catalogue.ts";
export {
  DublinCoreRecordSchema,
  type DublinCoreRecord,
} from "../../folio-assistant-core/schemas/dublin-core.ts";
// The l1-extraction viewer (`scripts/gen-l1-extraction-pages.ts`): where a
// declared visualiser's pages go, and where the library publisher puts an
// entry's sub-graph files.
export {
  checkoutRootFor,
} from "../../cat-harness-tools/schemas/kg/cat-harness.js";
export {
  checkoutDirectories,
} from "../../cat-harness-tools/schemas/kg/harness-config.js";
export {
  siteRootFrom,
  visualiserRoute,
} from "../../cat-harness-tools/schemas/kg/visualiser-route.js";
export {
  declaredVisualisers,
  pageParts,
  siteOwnerDir,
  visualiserPageDir,
  withRenderedByFrontMatter,
  type DeclaredVisualiser,
} from "../../cat-harness-tools/scripts/viewer-declarations.js";
export {
  siteArg,
  sitePageAt,
} from "../../cat-harness-tools/scripts/lib/site-target.ts";
export {
  entryGraphSitePath,
} from "../../cat-harness-tools/scripts/lib/library-entry-graphs.ts";
export {
  EXTRACTED_STATEMENTS_SCHEMA_ID,
  ExtractedStatementsSchema,
  type ExtractedStatement,
  type ExtractedStatements,
} from "../../folio-assistant-core/schemas/extracted-statement.ts";
export {
  resolveSource,
  type ResolvedSource,
} from "../../folio-assistant-core/scripts/publish-extracted-statements.ts";
