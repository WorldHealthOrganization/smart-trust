/**
 * The platform symbols of the files the platform itself loads by glob.
 *
 * The platform reads three of this layer's paths without being asked:
 * `cat-harness-tools/schemas/ui/theme-by-ref.ts` imports `themes/themes.ts`,
 * `schemas/kg/kind-validator.ts` imports `schemas/**`, and
 * `schemas/kg/harness-config.ts` imports `pipeline/qa-checkers-*.ts`. Each
 * then sits in the closure of every check that loads a theme, a kind or the
 * QA checkers, such as `skill:register:check` and `kg:audit:check`. Through
 * the full barrel (`index.ts`) those files also loaded fhir-harness's IG-site
 * and AST readers, whose unannotated input sites left those checks' CI
 * input-hash fingerprint undetermined (beans folio-assistant-x35i, vgfp,
 * k3vv). So they import from here, and `schema.test.ts` holds both halves:
 * they do not import `index.ts`, and this module's closure reaches no
 * fhir-harness file and no platform script.
 *
 * `index.ts` re-exports this module, so the barrel's surface is unchanged and
 * the platform's location is still named in this directory only.
 *
 * @module smart-base/platform/schema
 */
export {
  ContentTypeRegistry,
  defaultContentTypes,
} from "../../cat-harness-tools/schemas/content/content-type.js";
export {
  SMART_BASE_NS,
} from "../../cat-harness-tools/schemas/kg/jsonld.js";
export {
  kgNodeLabelShape,
  type KgNodeLabels,
} from "../../cat-harness-tools/schemas/kg/kg-node.js";
export {
  termIri,
} from "../../cat-harness-tools/schemas/kg/namespaces.js";
export {
  THEME_SCHEMA_TAG,
  explainThemeFailure,
  resolveTheme,
  type ResolvedTheme,
  type Theme,
} from "../../cat-harness-tools/schemas/ui/theme.js";
export {
  type CheckerPaths,
  type CheckerResult,
} from "../../cat-harness-tools/schemas/sdlc/block-qa.js";
export {
  BlockBaseSchema,
} from "../../cat-harness-tools/schemas/constraints.js";
export {
  type BlockBase,
} from "../../cat-harness-tools/schemas/types.js";
export {
  BlockKindNodeSchema,
  builderOf,
  type BlockKindNode,
} from "../../cat-harness-tools/schemas/kg/block-kind-node.js";
export {
  ownDeclaredDirectories,
} from "../../cat-harness-tools/schemas/kg/declared-nodes.js";
export {
  RUN_CONTEXT_SCHEMA_TAG,
  RunContextSchema,
  runContextRef,
  type RunContext,
  type RunContextRef,
} from "../../cat-harness-tools/schemas/sdlc/run-context.ts";
