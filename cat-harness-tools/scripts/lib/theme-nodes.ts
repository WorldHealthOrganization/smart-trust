/**
 * The themes a layer declares, as knowledge-graph nodes.
 *
 * @module scripts/lib/theme-nodes
 *
 * One answer for `kg-export` (which mints each theme's IRI and writes its
 * `.jsonld`) and the themes viewer (which lists each theme, draws its page and
 * links that IRI), so the id a row links and the `@id` the export mints cannot
 * disagree. Owner, 2026-11-13, node-kind audit: every listed node kind has an
 * IRI, a JSON-LD document, a row and a page, no waivers.
 *
 * A layer's `themes` directory holds ONE module (`themes.ts`) exporting
 * `INSTANCE_THEMES`, and each entry of that list is a node: the theme, not the
 * file. The themes are read through `instanceThemes`, the one resolution every
 * generator uses, so the export cannot mint a theme the runtime does not
 * resolve. A theme's id is unique within its layer (`themeKey` keys it by
 * layer and id).
 */
import { join, relative, sep } from "node:path";

import { instanceDirectoriesForGraph, readDeclaration, siblingScopeFor } from "../../schemas/kg/cat-harness.ts";
import { INSTANCE_THEMES_MODULE, THEMES_GRAPH_TYPOLOGY, instanceThemes } from "../../schemas/ui/theme-by-ref.ts";
import type { ResolvedTheme } from "../../schemas/ui/theme.ts";

/** The subject kind a theme's IRI is minted as (`scripts/lib/subject-iri.ts`). */
export const THEME_SUBJECT_KIND = "theme";

/** One declared theme, as a node. */
export interface ThemeNode {
  id: string;
  /** The theme's own name. */
  title: string;
  description: string;
  /** `sticky`, `webpage` or `publication`. */
  kind: string;
  /** The module that declares it, relative to the layer root. */
  sourcePath: string;
  theme: ResolvedTheme;
}

/**
 * Every theme the layer at `root` declares in its own `themes` directory. A
 * layer that declares none, or whose module cannot be read, holds no theme
 * nodes: `check:instance-themes` is where an unreadable module is reported.
 */
export function themeNodes(root: string): ThemeNode[] {
  const name = readDeclaration(root)?.name;
  if (name === undefined) return [];
  const dirs = instanceDirectoriesForGraph(root, THEMES_GRAPH_TYPOLOGY);
  if (dirs.length === 0) return [];
  let got: ReturnType<typeof instanceThemes>;
  try {
    got = instanceThemes(siblingScopeFor(root), name);
  } catch {
    return [];
  }
  if (!got.ok) return [];
  const sourcePath = relative(root, join(dirs[0]!, INSTANCE_THEMES_MODULE)).split(sep).join("/");
  return got.themes.map((t) => {
    const named = t as ResolvedTheme & { name?: string; description?: string; kind?: string };
    return {
      id: t.id,
      title: named.name ?? t.id,
      description: named.description ?? `The ${named.kind ?? ""} theme ${t.id}, declared by ${name}.`.replace("  ", " "),
      kind: named.kind ?? "",
      sourcePath,
      theme: t,
    };
  });
}
