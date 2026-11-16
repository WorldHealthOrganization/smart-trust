/**
 * The voices a layer holds, as knowledge-graph nodes.
 *
 * @module scripts/lib/voice-nodes
 *
 * One answer for `kg-export` (which mints each voice's IRI and writes its
 * `.jsonld`) and the voices viewer (which lists each voice, draws its page and
 * links that IRI), so the id a row links and the `@id` the export mints cannot
 * disagree. Owner, 2026-11-13, node-kind audit: every listed node kind has an
 * IRI, a JSON-LD document, a row and a page, no waivers.
 *
 * A voice's id is its directory's name, which `loadVoices` already holds
 * equal to the `id` the file declares, and which is unique in its layer:
 * sub-graphs (`vendors/<id>/`) are declared from within, and a vendor voice
 * names itself after its vendor (`agent-skill-authoring-claude`).
 */
import { existsSync, readFileSync } from "node:fs";
import { relative, sep } from "node:path";

import { voiceFilesIn, voicesDirFor } from "../../schemas/content/voices.ts";

/** The subject kind a voice's IRI is minted as (`scripts/lib/subject-iri.ts`). */
export const VOICE_SUBJECT_KIND = "voice";

/** One voice file, as a node. */
export interface VoiceNode {
  /** The voice's id: its directory's name. */
  id: string;
  /** The file, absolute. */
  file: string;
  /** The file relative to the layer root. */
  sourcePath: string;
  title: string;
  description: string;
}

/**
 * Every voice in the voices directory `root` DECLARES, sub-graphs included,
 * in the order `voiceFilesIn` reads them. A layer that declares none holds no
 * voice nodes, and a directory the reader refuses (an undeclared vendor voice)
 * holds none either: `check-voices` is where that is reported. A file that does
 * not parse is still a node, so it is listed and its page says so.
 */
export function voiceNodes(root: string): VoiceNode[] {
  const dir = voicesDirFor(root);
  if (dir === undefined || !existsSync(dir)) return [];
  let files: { id: string; path: string }[];
  try {
    files = voiceFilesIn(dir);
  } catch {
    return [];
  }
  return files.map(({ id, path }) => {
    let doc: Record<string, unknown> | undefined;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) doc = parsed as Record<string, unknown>;
    } catch {
      doc = undefined;
    }
    const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v : undefined);
    return {
      id,
      file: path,
      sourcePath: relative(root, path).split(sep).join("/"),
      title: str(doc?.title) ?? `Voice ${id}`,
      description: doc === undefined ? "This file does not parse as a JSON object." : (str(doc.description) ?? `The editorial voice ${id}.`),
    };
  });
}
