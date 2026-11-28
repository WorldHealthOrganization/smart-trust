/**
 * `.pot` entries for a `user-scenario` file: the words a person reads on a
 * journey page, and nothing a machine resolves.
 *
 * A user scenario is JSON, so no prose extractor reaches it; until this
 * existed a layer's journeys were the one part of its site no translator
 * was ever handed. The translatable fields are listed here, by path, rather
 * than guessed from the data: an id, an href, a code of the trust ladder or a
 * FHIR resource key is text too, and translating any of them breaks a
 * reference. A field the kind adds later is untranslated until it is listed,
 * which is the safe direction: a missing template is reported by `--check`,
 * a mistranslated id is not.
 *
 * `msgctxt` is the field's path without indices (`step.narrative`), so the
 * same English in two different fields stays two entries, as the manifest
 * producer does with "title" and "caption".
 */
import type { PotEntry } from "./pot-extract.js";

/** A dotted path from the scenario root; `[]` steps into every element of an array. */
type FieldPath = string;

/**
 * Every field a person reads. Not listed, on purpose: `id`, `personas`,
 * `follows`, `trustLadder`, `parts`, `views[].model`/`view`, `references[].href`/`rel`,
 * `scene[].icon`, `steps[].id`/`lead`/`stories`/`realisedBy`/`requirements`/
 * `examples`/`includes`/`dak`, `experiences[].actor`/`emotion`,
 * `record.state` (a ladder code), `handoff.from`/`to` (actor ids or places
 * drawn by name), `fhirChanges[].resource`/`profile`/`profileOf`/`spec`,
 * `uses[].block`/`component`, `illustration.src`/`prompt`.
 */
export const USER_SCENARIO_TEXT_FIELDS: readonly FieldPath[] = [
  "title",
  "description",
  "when",
  "where",
  "country",
  "views[].label",
  "references[].label",
  "scene[].label",
  "steps[].title",
  "steps[].headline",
  "steps[].when",
  "steps[].where",
  "steps[].touchpoint",
  "steps[].narrative",
  "steps[].painPoint",
  "steps[].enabler",
  "steps[].policy",
  "steps[].technicalSummary",
  "steps[].gaps[]",
  "steps[].illustration.alt",
  "steps[].preconditions[].title",
  "steps[].preconditions[].description",
  "steps[].record.description",
  "steps[].record.heldWhere",
  "steps[].handoff.summary",
  "steps[].handoff.carrier",
  "steps[].handoff.payload",
  "steps[].whatIf[].scenario",
  "steps[].whatIf[].outcome",
  "steps[].experiences[].doing",
  "steps[].experiences[].feeling",
  "steps[].references[].label",
  "steps[].fhirChanges[].change",
  "steps[].fhirChanges[].why",
  "steps[].uses[].role",
];

/** The values at `path` in `node`, in document order. */
function valuesAt(node: unknown, path: readonly string[]): string[] {
  if (path.length === 0) return typeof node === "string" && node.trim() !== "" ? [node] : [];
  if (node === null || typeof node !== "object") return [];
  const [head, ...rest] = path as [string, ...string[]];
  const each = head.endsWith("[]");
  const key = each ? head.slice(0, -2) : head;
  const child = (node as Record<string, unknown>)[key];
  if (!each) return valuesAt(child, rest);
  if (!Array.isArray(child)) return [];
  return child.flatMap((c) => (rest.length === 0 ? valuesAt(c, []) : valuesAt(c, rest)));
}

/** The 1-based line of `value`'s first occurrence as a JSON string in `raw`; 1 when not found. */
function lineOf(raw: string, value: string): number {
  const needle = JSON.stringify(value).slice(1, -1).slice(0, 60);
  const at = raw.indexOf(needle);
  return at === -1 ? 1 : raw.slice(0, at).split("\n").length;
}

/** The context a field's entries carry: its path without the `[]` markers, `steps.` read as `step.`. */
export function contextOf(field: FieldPath): string {
  return field.replaceAll("[]", "").replace(/^steps\./, "step.");
}

/**
 * The `.pot` entries of one user scenario, field by field in the order of
 * {@link USER_SCENARIO_TEXT_FIELDS}, each value in document order. `source`
 * is the path a translator sees in `#:`, relative to the layer root.
 */
export function extractUserScenario(raw: string, source: string): PotEntry[] {
  const doc = JSON.parse(raw) as unknown;
  const out: PotEntry[] = [];
  for (const field of USER_SCENARIO_TEXT_FIELDS) {
    for (const msgid of valuesAt(doc, field.split("."))) {
      out.push({ source, line: lineOf(raw, msgid), msgid: msgid.trim(), kind: "json-field", msgctxt: contextOf(field) });
    }
  }
  return out;
}
