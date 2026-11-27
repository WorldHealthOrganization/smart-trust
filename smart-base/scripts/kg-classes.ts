/**
 * The SMART Guidelines KG classes smart-base names, read from its own code
 * lists: `code-lists/sgkg-l1-classes.json` and `code-lists/sgkg-l2-classes.json`.
 *
 * Document kinds name a section's class as `sgkg-l1#<code>` or
 * `sgkg-l2#<code>` (`modelledBy`), and the L1 extraction and the L1
 * recommendation scenarios emit those classes. Each checks against this set.
 *
 * The lists are GENERATED from the layer sources (each `smart-base/<Layer>/schemas/`) by
 * `smart-base/L1/schemas/emit.ts`, one per layer: L1, L2, L2-BPMN, L2-DMN and
 * L3. smart-kg is deprecated (owner, 2026-10-16); the lists were hand copies of
 * its files until #359.
 *
 * @module smart-base/scripts/kg-classes
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const HERE = resolve(import.meta.dir, "..");

/** The code list behind each class system. */
export const KG_CLASS_LISTS = {
  "sgkg-l1": join(HERE, "code-lists", "sgkg-l1-classes.json"),
  "sgkg-l2": join(HERE, "code-lists", "sgkg-l2-classes.json"),
  "sgkg-l2-bpmn": join(HERE, "code-lists", "sgkg-l2-bpmn-classes.json"),
  "sgkg-l2-dmn": join(HERE, "code-lists", "sgkg-l2-dmn-classes.json"),
  "sgkg-l3": join(HERE, "code-lists", "sgkg-l3-classes.json"),
} as const;

/** Every class, as `<system>#<code>`. */
export function kgClasses(lists: Record<string, string> = KG_CLASS_LISTS): Set<string> {
  const out = new Set<string>();
  for (const [system, file] of Object.entries(lists)) {
    const list = JSON.parse(readFileSync(file, "utf-8")) as { codes: { code: string; status?: string }[] };
    // Only active codes are the list's values; a retired code stays resolvable but is not offered.
    for (const c of list.codes) if (c.status !== "retired") out.add(`${system}#${c.code}`);
  }
  return out;
}
