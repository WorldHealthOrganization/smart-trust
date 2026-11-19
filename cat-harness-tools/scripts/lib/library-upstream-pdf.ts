/**
 * WHERE A SOURCE THIS SITE DOES NOT HOLD CAN BE READ — the entry's own file
 * upstream, linked out from its page.
 *
 * A referenced item's PDF is never stored here (owner, 2026-11-10: "do not
 * materialize original asset on the KG"), and the upstream will not lend it
 * to a viewer: measured 2026-11-11, IRIS answers a request carrying this
 * site's `Origin` with 403 and sends `X-Frame-Options: DENY`. Owner,
 * 2026-11-11 (card, option C): keep link-out only. The page's "not held"
 * line had said "No public link is recorded" for derived language editions,
 * though their catalogue node records each file's upstream; this reads it.
 */
import { existsSync, readFileSync } from "node:fs";
import { slugOfLocal } from "./library-languages.ts";

export interface UpstreamPdf {
  /** The file's name, as the catalogue records it. */
  file: string;
  /** Where it is upstream (`provenance.upstream`). */
  href: string;
  /** SHA-256 of the bytes the entry was derived from (`fixity.digest`), when recorded. */
  sha256?: string;
}

/**
 * The upstream PDF an entry was derived from: the ORIGINAL bitstream of its
 * catalogue node whose `provenance.local` names the entry. `undefined` when
 * the node records none, or names no `https:` upstream.
 */
export function upstreamPdfOf(nodePath: string | undefined, slug: string): UpstreamPdf | undefined {
  if (!nodePath || !existsSync(nodePath)) return undefined;
  let node: { bitstreams?: { name?: unknown; bundle?: unknown; materialization?: { provenance?: { local?: unknown; upstream?: unknown }; fixity?: { algorithm?: unknown; digest?: unknown } } }[] };
  try {
    node = JSON.parse(readFileSync(nodePath, "utf-8"));
  } catch {
    return undefined;
  }
  for (const b of node.bitstreams ?? []) {
    const m = b.materialization;
    if (b.bundle !== "ORIGINAL" || slugOfLocal(m?.provenance?.local) !== slug) continue;
    const href = m?.provenance?.upstream;
    if (typeof href !== "string" || !/^https:\/\//.test(href) || typeof b.name !== "string") continue;
    const d = m?.fixity?.algorithm === "sha256" && typeof m.fixity.digest === "string" && /^[0-9a-f]{64}$/.test(m.fixity.digest)
      ? m.fixity.digest
      : undefined;
    return { file: b.name, href, ...(d ? { sha256: d } : {}) };
  }
  return undefined;
}
