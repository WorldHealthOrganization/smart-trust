/**
 * Does a `recommendation` block's `strength` resolve? Bean `55ao`.
 *
 * @module folio-assistant-core/schemas/recommendation-strength
 * @graphNode schema
 *
 * The owner, 2026-09-23 (Q2): strength is **a reference to a SKOS vocabulary
 * or value set**, not a closed enum and not free text. WHO's GRADE is not
 * IETF's RFC 2119, so each domain brings its own code list
 * (`folio-code-list/v1`, exported as a SKOS concept scheme), and the check is
 * "resolves in the scheme":
 *
 * - the list is one the folio can see: its own `code-lists/` and every
 *   dependency's, in overlay order (`codeListDirs`);
 * - the code is in that list;
 * - the code is not retired. A retired code stays resolvable for the record,
 *   but is no longer a value an author may choose.
 *
 * A recommendation with NO strength is not a finding here: the field is
 * optional, because some issuing bodies state none. Whether a folio requires
 * one is that folio's rule, not the platform's.
 *
 * This module is the RULE. The QA checker that applies it per block is
 * tooling, and lives in `pipeline/qa-checkers-recommendation.ts`, where
 * the harness's `imports` input-site for a contributed checker looks
 * (`<instance>/pipeline/qa-checkers-*.ts`), as sci's cost checkers and
 * the DAK layer's checkers do.
 */
import type { CodeList } from "@litlfred/cat-harness-tools/schemas/library/code-list.js";
import type { CodeRef } from "@litlfred/cat-harness-tools/schemas/types.js";

/** Why a strength does not resolve, or `null` when it does (or is absent). */
export function strengthFinding(strength: CodeRef | undefined, lists: ReadonlyMap<string, CodeList>): string | null {
  if (strength === undefined) return null;
  const list = lists.get(strength.list);
  if (!list) {
    const known = [...lists.keys()].sort().join(", ") || "none";
    return `strength names code list "${strength.list}", which no instance this folio depends on declares (declared: ${known})`;
  }
  const code = list.codes.find((c) => c.code === strength.code);
  if (!code) {
    return `strength names code "${strength.code}", which code list "${list.id}" does not hold (codes: ${list.codes.map((c) => c.code).join(", ")})`;
  }
  if (code.status === "retired") return `strength names code "${strength.code}" of "${list.id}", which is retired`;
  return null;
}
