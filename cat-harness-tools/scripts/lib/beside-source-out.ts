/**
 * Where `render:bpmn` writes the drawing it makes BESIDE a `.bpmn` source.
 *
 * In a layer's own checkout that copy is committed beside the source (bean
 * folio-assistant-akiq). In a site BUILD it is not wanted there: the site
 * reads its own copy (`<site>/assets/img/workflows/`), and a drawing written
 * beside an IG's `input/business-processes/*.bpmn` is an untracked file under
 * `input/`, so the next run read the cached IG AST as `stale-inputs` and
 * refused a root publish (an IG's first agent publish, 2026-11-06). A build therefore
 * names a directory outside the checkout in {@link BESIDE_SOURCE_OUT_ENV},
 * and the drawings go there, at their repository-relative paths.
 *
 * @module cat-harness-tools/scripts/lib/beside-source-out
 */
import { isAbsolute, join, relative } from "node:path";

/** The environment variable a build sets to send beside-source drawings out of the checkout. */
export const BESIDE_SOURCE_OUT_ENV = "RENDER_BPMN_BESIDE_SOURCE_OUT";

/**
 * The `.svg` path for `source`: beside it when `outDir` is unset, else under
 * `outDir` at its path relative to `repoRoot` (a source outside `repoRoot`
 * keeps its absolute path's segments under `outDir/_outside/`).
 */
export function besideSourceTarget(source: string, repoRoot: string, outDir?: string): string {
  const svg = (p: string) => p.replace(/\.bpmn$/, ".svg");
  if (!outDir) return svg(source);
  const rel = relative(repoRoot, source);
  const inside = rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  return svg(inside ? join(outDir, rel) : join(outDir, "_outside", source));
}
