/**
 * The attestation files a layer holds, as knowledge-graph nodes.
 *
 * @module scripts/lib/attestation-nodes
 *
 * One answer for `kg-export` (which mints each one's IRI and writes its
 * `.jsonld`) and the attestations folder page (which lists each one and
 * links that IRI), so the id a row links and the `@id` the export mints
 * cannot disagree. Owner, 2026-11-13, node-kind audit: every listed node kind
 * has an IRI, a JSON-LD document, a row and a page, no waivers.
 *
 * A node's id is its file's path under the layer's attestations store without
 * {@link ATTESTATIONS_SUFFIX}: `<family>/<mirrored subject path>`, which is
 * unique in the store because the store's own layout makes it so.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { ATTESTATIONS_SUFFIX, attestationsHomeFor } from "../../schemas/sdlc/qa-attestations.ts";

/** One attestation file, as a node. */
export interface AttestationNode {
  /** `<family>/<mirrored subject path>`: the IRI's last segments. */
  id: string;
  /** The file, absolute. */
  file: string;
  /** The file relative to the layer root. */
  sourcePath: string;
  family: string;
  subject?: { kind: string; id: string; path: string | null };
  title: string;
  description: string;
}

/** The id of the attestation file `file` (absolute) in the store at `store`, or undefined for any other file. */
export function attestationId(store: string, file: string): string | undefined {
  if (!file.endsWith(ATTESTATIONS_SUFFIX)) return undefined;
  const rel = relative(store, file).split(sep).join("/");
  if (rel.startsWith("..") || rel === "") return undefined;
  return rel.slice(0, -ATTESTATIONS_SUFFIX.length);
}

function* walk(dir: string): Generator<string> {
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return;
  }
  for (const n of names) {
    const p = join(dir, n);
    let dirLike = false;
    try {
      dirLike = statSync(p).isDirectory();
    } catch {
      continue;
    }
    if (dirLike) yield* walk(p);
    else if (n.endsWith(ATTESTATIONS_SUFFIX)) yield p;
  }
}

/** The words a row and a node carry for one attestation file. */
export function describeAttestation(family: string, subject: AttestationNode["subject"]): { title: string; description: string } {
  const what = subject ? `${subject.kind} ${subject.id}` : "an unnamed subject";
  return {
    title: `${family} attestation: ${what}`,
    description: `The ${family} judgements recorded for ${what}${subject?.path ? ` (${subject.path})` : ""}, each pinned to the hash it attested.`,
  };
}

/**
 * Every attestation file in the attestations directory `root` DECLARES
 * (`attestationsHomeFor`'s `own`): a hosted or conventional store is the host's
 * to publish, and a store that is not there holds no nodes. A file that does
 * not parse is still a node, so it is listed and its page says so.
 */
export function attestationNodes(root: string): AttestationNode[] {
  let store: string;
  try {
    const home = attestationsHomeFor(root);
    if (home.by !== "own" || !existsSync(home.root)) return [];
    store = home.root;
  } catch {
    return [];
  }
  const out: AttestationNode[] = [];
  for (const file of walk(store)) {
    const id = attestationId(store, file)!;
    let doc: Record<string, unknown> | undefined;
    try {
      const parsed = JSON.parse(readFileSync(file, "utf-8")) as unknown;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) doc = parsed as Record<string, unknown>;
    } catch {
      doc = undefined;
    }
    const family = typeof doc?.family === "string" ? doc.family : id.split("/")[0]!;
    const s = doc?.subject as { kind?: unknown; id?: unknown; path?: unknown } | undefined;
    const subject =
      s && typeof s.kind === "string" && typeof s.id === "string"
        ? { kind: s.kind, id: s.id, path: typeof s.path === "string" ? s.path : null }
        : undefined;
    const words = doc === undefined
      ? { title: `${family} attestation: ${id}`, description: "This file does not parse as a JSON object." }
      : describeAttestation(family, subject);
    out.push({ id, file, sourcePath: relative(root, file).split(sep).join("/"), family, ...(subject ? { subject } : {}), ...words });
  }
  return out;
}
