/**
 * Code lists, as the FHIR projection needs them.
 *
 * L1 3.0 declares its own eighteen value sets (`l1.ts`, carried verbatim from
 * smart-kg), so they are the source: every bound property takes its codes from
 * them, and each becomes one FSH CodeSystem + ValueSet. The one list smart-kg
 * keeps outside the ontology — the graph document's `derivation` — is declared
 * here.
 *
 * REUSE, checked: folio-assistant's `cat-harness/code-lists/grade-*.json`
 * (bean wg7r) hold the same codes as 3.0's `recommendation-strength`,
 * `certainty` and `recommendation-direction` — strong/conditional,
 * high/moderate/low/very-low, for/against — so there is one vocabulary, not
 * two; the 3.0 definitions, sourced to the WHO handbook, are the ones emitted.
 */
import { z } from "zod";

import type { ValueSet } from "./ontology.ts";

export interface Code {
  code: string;
  display: string;
  definition: string;
}

export interface CodeList {
  /** FSH name of the CodeSystem; its all-codes ValueSet is `<name>VS`. */
  name: string;
  title: string;
  description: string;
  /** Where the list came from, so a reviewer can check the migration. */
  source: string;
  codes: readonly Code[];
}

/** `recommendation-strength` → `RecommendationStrength`. */
export const pascal = (id: string): string => id.replace(/(^|-)([a-z0-9])/g, (_m, _d, ch: string) => ch.toUpperCase());

/** `very-low` → `Very low`. */
const display = (code: string): string => {
  const s = code.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** A smart-kg value set, as a code list for the FHIR projection. */
export function codeListOf(v: ValueSet, layer: string): CodeList {
  return {
    name: `KG${pascal(v.id)}`,
    title: `Knowledge graph ${layer}: ${display(v.id).toLowerCase()}`,
    description: v.note,
    source: `smart-kg ontology/${layer.toLowerCase()}/${layer.toLowerCase()}.json valueSets "${v.id}"; ${v.source}`,
    codes: v.codes.map((c) => ({ code: c.code, display: display(c.code), definition: c.definition })),
  };
}

export const DERIVATION: CodeList = {
  name: "KGDerivation",
  title: "Knowledge graph: derivation",
  description:
    "How a node or edge of a SMART Guidelines knowledge graph came to be. Every node and edge is exactly one of the three, and `decided` is the one a reviewer needs to find.",
  source: "smart-kg shapes/recommendation-graph.schema.json $defs.derivation",
  codes: [
    { code: "derived", display: "Derived", definition: "Mechanically produced, no choice involved." },
    { code: "inferred", display: "Inferred", definition: "A rule that could reasonably have gone another way." },
    { code: "decided", display: "Decided", definition: "The source is silent and someone chose." },
  ],
};

/** A Zod enum over a list's codes. */
export function enumOf(l: { codes: readonly Code[] }) {
  return z.enum(l.codes.map((c) => c.code) as [string, ...string[]]);
}
