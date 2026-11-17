/**
 * Citation extraction utility.
 *
 * Parses \cite{key1, key2} patterns from markdown content
 * and returns deduplicated, sorted citation keys.
 *
 * Used by:
 * - export-json.ts to auto-populate block-level cites[]
 * - build.ts to aggregate chapter-level bibliographies
 * - validate-references.ts for cross-checking
 *
 * @module pipeline/citations
 */

/**
 * Extract all citation keys from markdown content.
 *
 * Handles:
 * - \cite{key}
 * - \cite{key1, key2, key3}
 * - \cite[Thm.~1.7]{key}
 * - \cite[\S3]{key}
 * - [key] bare bracket notation (common in .md prose)
 *
 * The bracket notation is validated against a known set of reference IDs
 * (if provided) to avoid false positives from markdown links, anchors, etc.
 *
 * Returns deduplicated, sorted array of citation keys.
 */
export function extractCitations(md: string, knownRefIds?: Set<string>): string[] {
  const keys = new Set<string>();

  // 1. Match \cite with optional [...] argument, then {keys}
  const citePattern = /\\cite(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let match;
  while ((match = citePattern.exec(md)) !== null) {
    for (const key of match[1].split(",")) {
      const trimmed = key.trim();
      if (trimmed) keys.add(trimmed);
    }
  }

  // 2. Match bare bracket citations [refkey] — authorYYYY pattern
  //    Only match if not part of a markdown link [text](url) or
  //    an anchor [text](#id) or image ![alt](src).
  //    Pattern: [lowercase-letters + digits ending in 4-digit year]
  const bracketPattern = /(?<![!\w])\[([a-z][a-z0-9-]*\d{4}[a-z]*)\](?!\()/g;
  while ((match = bracketPattern.exec(md)) !== null) {
    const key = match[1];
    // If we have a known ref list, only accept keys that exist in it
    if (knownRefIds) {
      if (knownRefIds.has(key)) keys.add(key);
    } else {
      keys.add(key);
    }
  }

  return [...keys].sort();
}

/**
 * Merge explicit cites[] from manifest with auto-extracted ones from .md.
 *
 * Explicit cites take precedence (they may include keys not in the .md,
 * e.g. for citations in Lean companion files).
 */
export function mergeCitations(
  explicit: string[] | undefined,
  mdContent: string,
): string[] {
  const fromMd = extractCitations(mdContent);
  if (!explicit?.length) return fromMd;
  const merged = new Set([...explicit, ...fromMd]);
  return [...merged].sort();
}
