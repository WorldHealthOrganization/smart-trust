/**
 * The ONE file in this instance that names where the platform lives.
 *
 * who-iris is staged here ahead of becoming its own repository
 * (`litlfred/who-iris`). Every platform symbol the replica generator uses is
 * re-exported from here, so the day it leaves, re-pointing the platform is a
 * one-file edit — the reason the DAK layer's and
 * the trust layer's `platform.ts` exist. The rule is held by
 * `cat-harness-tools/scripts/tests/instance-separation-imports.test.ts`.
 *
 * Created 2026-10-05 for the replica's translations (issue #2228, bean
 * `lffo`). Translating the replica needs the gettext reader and writer, two
 * NEW climbs, against a who-iris ceiling that "may only fall". Rather than
 * raise it, `gen-iris-pages.ts` now routes every platform import through
 * here, which takes it from fourteen climbs to none. The tests and the theme
 * module still climbed directly; they were what the ceiling counted.
 *
 * Since 2026-10-06 (bean `g8jp`) EVERYTHING climbs here, and this file in
 * turn reaches only `folio-assistant-core` — the one instance who-iris
 * `needs`. cat-harness symbols come through core's surface,
 * `folio-assistant-core/scripts/platform.ts`, so who-iris names no layer
 * below the one it declares. Owner: *"who-iris depends on folio-asst-core"*.
 *
 * **Re-pointed 2026-10-09 (kg-separation stage 10).** who-iris is now its own
 * repository, and its dependencies are REMOTE MOUNTS inside its checkout
 * (`index.config.json`, `mount:remote`) -- the owner's g8jp ruling that
 * imports "resolve through the mounted paths". So core is
 * `./folio-assistant-core/`, not a sibling: the old `../` reached OUTSIDE the
 * repository and resolved only where something happened to sit beside it.
 * This is the interim (owner, 2026-10-09: "option 1 and option 2 now"):
 * the target is a PACKAGE import (`@litlfred/folio-assistant-core`,
 * separation lesson 5), which this file switches to in one edit once core is
 * package-importable.
 *
 * **Switched 2026-10-09.** The `./folio-assistant-core/` paths resolved only
 * where core is mounted inside a who-iris checkout; in the composed index it
 * is a sibling, and `landing:data:check` failed with "Cannot find module".
 * The package name resolves in both layouts through the workspace install.
 *
 * @module who-iris/platform
 */
export {
  readDeclaration,
  repoRootFor,
  siteDirFor,
  fragment as folioMountFragment,
  embed as pdfViewer,
  subjectPage,
  withRoutes,
  libraryResolver,
  themedPage,
  withInlineCode,
  formatPot,
  type PotEntry,
  parsePo,
  parsePoEntries,
  THEME_SCHEMA_TAG,
  ThemeSchema,
  ResolvedThemeSchema,
  explainThemeFailure,
  resolveTheme,
  themeKey,
  type ResolvedTheme,
  type Theme,
  DEFAULT_THEME_ID,
  themeById,
  visualiserRoute,
  declaredRoute,
  siteOwnerDir,
  visualiserPageDir,
  withRenderedBy,
  withRenderedByFrontMatter,
  defineTool,
  type ToolDefinition,
  toolTypeIri,
  toolFactory,
  toolsFromFolders,
} from "@litlfred/folio-assistant-core/scripts/platform.ts";
export { bytesFor, repoRelative } from "@litlfred/folio-assistant-core/scripts/lib/bytes.ts";
export { CATALOGUE_NODE_SCHEMA_TAG, CatalogueNodeSchema, resolvableIri, type CatalogueNode } from "@litlfred/folio-assistant-core/schemas/catalogue.ts";
export { dspaceToRecord } from "@litlfred/folio-assistant-core/scripts/fetch-dspace-item.ts";
export { dcRenderingsFor } from "@litlfred/folio-assistant-core/scripts/dc-render.ts";
export { publicationBlockers } from "@litlfred/folio-assistant-core/schemas/materialization.ts";
export { nodes as coverNodes, pngSize } from "@litlfred/folio-assistant-core/scripts/gen-covers.ts";
