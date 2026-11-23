/**
 * JSON shape comparison for generated projections.
 *
 * @module scripts/lib/json-shape
 */

/**
 * Top-level keys of the freshly generated JSON that the committed copy lacks
 * (bean `324x`). Not a content comparison — a `verdict` projection's contents
 * move by design — only "is the committed file the shape the generator now
 * writes". Empty for anything that is not a JSON object on both sides.
 */
export function missingTopLevelKeys(committed: string, generated: string): string[] {
  const obj = (t: string): Record<string, unknown> | undefined => {
    try {
      const v = JSON.parse(t) as unknown;
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
    } catch {
      return undefined;
    }
  };
  const a = obj(committed);
  const b = obj(generated);
  if (!a || !b) return [];
  return Object.keys(b).filter((key) => !(key in a)).sort();
}
