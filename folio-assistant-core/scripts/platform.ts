/**
 * folio-assistant-core's SURFACE for the layers that `needs` it: every
 * platform symbol such a layer uses, re-exported from the one module it
 * may reach.
 *
 * A layer on core declares `"needs": ["folio-assistant-core"]` and never
 * names cat-harness — owner, 2026-10-06 (bean `g8jp`): a layer on core
 * depends on core, never on the layers below it. So those are reached TRANSITIVELY,
 * through here: the layer's own `platform.ts` imports this file and
 * nothing else outside its directory, and core decides which of its
 * dependencies' symbols it carries. When such a layer leaves for its own
 * repository it remote-mounts core and core's dependency closure; a
 * re-export here resolves through core's mounted `scripts/` like any other
 * core module, and no import in the layer assumes a monorepo sibling.
 *
 * Grouped by the module each symbol comes from. Add a symbol here when a
 * layer on core needs it — never a direct climb from the layer, which
 * `cat-harness-tools/scripts/tests/instance-separation-imports.test.ts` refuses.
 *
 * @module folio-assistant-core/scripts/platform
 */

// ── cat-harness: declarations and site layout ─────────────────────────────
export { readDeclaration, repoRootFor, siteDirFor } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";

// ── cat-harness: page chrome and mounting ─────────────────────────────────
export { fragment } from "@litlfred/cat-harness-tools/scripts/folio-mount.ts";
export { embed } from "@litlfred/cat-harness-tools/scripts/pdf-viewer.ts";
export { subjectPage } from "@litlfred/cat-harness-tools/scripts/harness-tiles.js";

// ── cat-harness: declared visualisers and their routes (owner, 2026-10-09) ─
// A harness declares each visualiser in its own `<instance>.json`
// `visualisers`; its URL is `visualiserRoute`'s, never composed by a page.
export { visualiserRoute, siteRootFrom } from "@litlfred/cat-harness-tools/schemas/kg/visualiser-route.js";
export { declaredRoute, siteOwnerDir, visualiserPageDir, withRenderedBy, withRenderedByFrontMatter } from "@litlfred/cat-harness-tools/scripts/viewer-declarations.js";

// ── cat-harness: Tool nodes, for a layer's own `tools` graph ──────────
export { defineTool, type ToolDefinition } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";
export { toolTypeIri } from "@litlfred/cat-harness-tools/schemas/tools/tool-types.js";
export { toolFactory, toolsFromFolders } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
export { withRoutes } from "@litlfred/cat-harness-tools/scripts/mount-instance-docs.ts";
export { libraryResolver } from "@litlfred/cat-harness-tools/scripts/lib/library-links.ts";
export { withViewerNav } from "@litlfred/cat-harness-tools/scripts/viewer-page.ts";
export { themedPage } from "@litlfred/cat-harness-tools/scripts/lib/themed-page.ts";
export { withInlineCode } from "@litlfred/cat-harness-tools/schemas/content/inline-code.ts";

// ── cat-harness: gettext ──────────────────────────────────────────────────
export { formatPot, type PotEntry } from "@litlfred/cat-harness-tools/pipeline/pot-extract.js";
export { parsePo, parsePoEntries } from "@litlfred/cat-harness-tools/pipeline/po-inject.js";

// ── cat-harness: themes ───────────────────────────────────────────────────
export {
  THEME_SCHEMA_TAG,
  ThemeSchema,
  ResolvedThemeSchema,
  explainThemeFailure,
  resolveTheme,
  themeKey,
  type ResolvedTheme,
  type Theme,
} from "@litlfred/cat-harness-tools/schemas/ui/theme.js";
export { DEFAULT_THEME_ID, themeById } from "@litlfred/cat-harness-tools/schemas/ui/themes.js";
