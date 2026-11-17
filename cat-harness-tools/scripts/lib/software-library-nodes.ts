/**
 * The outside software libraries a layer declares, as knowledge-graph nodes.
 *
 * @module scripts/lib/software-library-nodes
 *
 * One answer for `kg-export` (which mints each library's IRI and writes its
 * `.jsonld`) and the layer's software-libraries page (which lists each one and
 * links that IRI and its node-kind page), so the id a row links and the `@id`
 * the export mints cannot disagree. Owner, 2026-11-13, node-kind audit: every
 * listed node kind has an IRI, a JSON-LD document, a row and a page, no
 * waivers.
 *
 * A library's id is its file's name without {@link SOFTWARE_LIBRARY_SUFFIX}
 * (`types__jsonld`), unique in its directory because the writer names the file
 * after the package.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { instanceDirectoriesForGraph } from "../../schemas/kg/cat-harness.ts";

/** The graph typology that holds them. */
export const SOFTWARE_LIBRARY_KIND = "software-library";
/** The subject kind a library's IRI is minted as (`scripts/lib/subject-iri.ts`). */
export const SOFTWARE_LIBRARY_SUBJECT_KIND = "softwareLibrary";
/** The ending of a library node's file. */
export const SOFTWARE_LIBRARY_SUFFIX = ".library.json";

/** One library file, as a node. */
export interface SoftwareLibraryNode {
  id: string;
  /** The file, absolute. */
  file: string;
  /** The file relative to the layer root. */
  sourcePath: string;
  title: string;
  description: string;
}

/** The words a row and a node carry for one library: `name@version`, and what it is. */
export function describeLibrary(doc: Record<string, unknown> | undefined, id: string): { title: string; description: string } {
  if (doc === undefined) return { title: id, description: "This file does not parse as a JSON object." };
  const name = typeof doc.name === "string" ? doc.name : id;
  const version = typeof doc.version === "string" ? doc.version : undefined;
  const licence = typeof doc.licence === "string" ? doc.licence : undefined;
  return {
    title: version === undefined ? name : `${name}@${version}`,
    description:
      `The outside library ${name}${version ? ` ${version}` : ""}${doc.dev === true ? " (a dev dependency)" : ""}` +
      `${licence ? `, licensed ${licence}` : ""}, as the layer's lockfile pins it.`,
  };
}

/** Every library file directly in the `software-library` directories the layer at `root` declares as its own. */
export function softwareLibraryNodes(root: string): SoftwareLibraryNode[] {
  let dirs: string[];
  try {
    dirs = instanceDirectoriesForGraph(root, SOFTWARE_LIBRARY_KIND);
  } catch {
    return [];
  }
  const out: SoftwareLibraryNode[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(SOFTWARE_LIBRARY_SUFFIX)) continue;
      const file = join(dir, name);
      let doc: Record<string, unknown> | undefined;
      try {
        const parsed = JSON.parse(readFileSync(file, "utf-8")) as unknown;
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) doc = parsed as Record<string, unknown>;
      } catch {
        doc = undefined;
      }
      const id = name.slice(0, -SOFTWARE_LIBRARY_SUFFIX.length);
      out.push({ id, file, sourcePath: relative(root, file).split(sep).join("/"), ...describeLibrary(doc, id) });
    }
  }
  return out;
}
