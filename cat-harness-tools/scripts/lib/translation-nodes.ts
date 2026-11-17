/**
 * The gettext sources a layer declares, as knowledge-graph nodes.
 *
 * @module scripts/lib/translation-nodes
 *
 * One answer for `kg-export` (which mints each catalogue's and template's IRI
 * and writes its `.jsonld`) and the translation-status viewer (which lists
 * each one and draws its page), so the id a row links and the `@id` the export
 * mints cannot disagree. Owner, 2026-11-13, node-kind audit: every listed node
 * kind has an IRI, a JSON-LD document, a row and a page, no waivers.
 *
 * Each `.po` catalogue and `.pot` template under a layer's
 * `translation-sources` directory is a node. Its id is its path under the
 * directory WITH its ending (`es/processes/x.pot`), because a catalogue and the
 * template it was made from often share a stem. Its PAGE is keyed by the stem
 * (`es/processes/x/`), which is how the directory reads to a person: one page
 * for a string set in one locale, its catalogue and its template side by side.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { instanceDirectoriesForGraph } from "../../schemas/kg/cat-harness.ts";

/** The graph typology that holds them. */
export const TRANSLATION_SOURCES_KIND = "translation-sources";
/** The subject kind a catalogue's IRI is minted as (`scripts/lib/subject-iri.ts`). */
export const TRANSLATION_SUBJECT_KIND = "translationSource";

/** One `.po` or `.pot` file, as a node. */
export interface TranslationNode {
  /** Its path under the directory, with its ending: the IRI's last segments. */
  id: string;
  /** {@link id} without `.po`/`.pot`: its page's path under the layer's. */
  stem: string;
  /** The first segment: the target locale. */
  locale: string;
  /** A `.pot` template rather than a `.po` catalogue. */
  template: boolean;
  /** The file, absolute. */
  file: string;
  /** The file relative to the layer root. */
  sourcePath: string;
  title: string;
  description: string;
}

const ENDING = /\.pot?$/;

function* walk(dir: string): Generator<string> {
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return;
  }
  for (const n of names) {
    if (n.startsWith(".")) continue;
    const p = join(dir, n);
    let isDir = false;
    try {
      isDir = statSync(p).isDirectory();
    } catch {
      continue;
    }
    if (isDir) yield* walk(p);
    else if (ENDING.test(n)) yield p;
  }
}

/** Every `.po` and `.pot` under the `translation-sources` directories the layer at `root` declares as its own, in path order. */
export function translationNodes(root: string): TranslationNode[] {
  let dirs: string[];
  try {
    dirs = instanceDirectoriesForGraph(root, TRANSLATION_SOURCES_KIND);
  } catch {
    return [];
  }
  const out: TranslationNode[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const id = relative(dir, file).split(sep).join("/");
      const stem = id.replace(ENDING, "");
      const locale = id.split("/")[0]!;
      const template = id.endsWith(".pot");
      const rest = stem.slice(locale.length + 1) || stem;
      out.push({
        id,
        stem,
        locale,
        template,
        file,
        sourcePath: relative(root, file).split(sep).join("/"),
        title: `${rest} (${locale}${template ? ", template" : ""})`,
        description: template
          ? `The gettext template of the strings ${rest} holds, extracted for the ${locale} locale: what can be translated.`
          : `The ${locale} gettext catalogue of the strings ${rest} holds: what has been translated, and what is fuzzy.`,
      });
    }
  }
  return out;
}
