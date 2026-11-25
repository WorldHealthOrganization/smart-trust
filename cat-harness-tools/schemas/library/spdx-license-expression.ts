/**
 * An SPDX licence expression, checked against the pinned SPDX License List.
 *
 * @module schemas/spdx-license-expression
 * @graphNode schema
 *
 * Checks `licence.json`'s `id` ("SPDX where one exists"). The License List is
 * used as a VALUE VOCABULARY; no SPDX documents are produced.
 *
 * ## The grammar is the held specification's, not a recollection of it
 *
 * SPDX 3.0 Annex B (`library/omg-2024-spdx-3-0`, `sec-327`…`sec-332`):
 *
 * ```
 * idstring            = 1*(ALPHA / DIGIT / "-" / "." )
 * license-ref         = ["DocumentRef-"(idstring)":"]"LicenseRef-"(idstring)
 * addition-ref        = ["DocumentRef-"(idstring)":"]"AdditionRef-"(idstring)
 * simple-expression   = license-id / license-id"+" / license-ref
 * addition-expression = license-exception-id / addition-ref
 * compound-expression = simple-expression
 *                     / simple-expression ("WITH" / "with") addition-expression
 *                     / compound-expression ("AND" / "and") compound-expression
 *                     / compound-expression ("OR" / "or") compound-expression
 *                     / "(" compound-expression ")"
 * ```
 *
 * Three rules from the prose around it, each enforced here:
 *
 * - operators *"should be matched in a case-sensitive manner, i.e., letters
 *   must be all upper case or all lower case"* (`sec-328`) — `And` is refused;
 * - licence and exception ids match **case-insensitively** (`sec-328`), so
 *   `mit` is MIT — accepted, and the canonical spelling is reported back;
 * - precedence is `WITH` over `AND` over `OR` (`sec-332`), and *"There MUST
 *   NOT be white space between a license-id and any following +"* (`sec-329`).
 *
 * ## Deprecated is reported, not refused
 *
 * A deprecated id (`GPL-2.0`, say) still names a licence; the list only asks
 * that it not be used in NEW records. So a record carrying one is valid, and
 * the id comes back in `deprecated` for the check to report as its own family
 * rather than fold into `malformed`.
 *
 * @conformsTo spdx-license-list
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PinnedTerminologySchema } from "../content/pinned-terminology.ts";

/** The pin record, repository-relative. */
// declared-path-literal: the pinned edition's record and snapshot, addressed by path because the
// pin is to these exact files in cat-harness, the layer below that holds them.
export const SPDX_LICENSE_LIST_PIN = "cat-harness/external-schemas/spdx-license-list.json";
/** The derived snapshot of the pinned edition's ids, repository-relative. */
export const SPDX_LICENSE_LIST_SNAPSHOT = "cat-harness/external-schemas/spdx-license-list.terminology.json";

/** The ids of one License List edition, keyed by lower-cased id. */
export interface SpdxLicenseList {
  version: string;
  licenses: ReadonlyMap<string, { id: string; deprecated: boolean }>;
  exceptions: ReadonlyMap<string, { id: string; deprecated: boolean }>;
}

/** Build the lookup from concepts (`system` `spdx-license` / `spdx-exception`). Pure. */
export function spdxLicenseListOf(
  version: string,
  concepts: readonly { system: string; code: string; deprecated?: boolean }[],
): SpdxLicenseList {
  const licenses = new Map<string, { id: string; deprecated: boolean }>();
  const exceptions = new Map<string, { id: string; deprecated: boolean }>();
  for (const c of concepts) {
    const into = c.system === "spdx-license" ? licenses : c.system === "spdx-exception" ? exceptions : undefined;
    into?.set(c.code.toLowerCase(), { id: c.code, deprecated: c.deprecated === true });
  }
  return { version, licenses, exceptions };
}

/**
 * Load the pinned edition, or say why it could not be loaded. A string is
 * could-not-determine — the caller must not read it as "no id is valid".
 */
export function loadSpdxLicenseList(repoRoot: string): SpdxLicenseList | string {
  let pin: { version?: unknown };
  let raw: unknown;
  try {
    pin = JSON.parse(readFileSync(join(repoRoot, SPDX_LICENSE_LIST_PIN), "utf-8")) as { version?: unknown };
    raw = JSON.parse(readFileSync(join(repoRoot, SPDX_LICENSE_LIST_SNAPSHOT), "utf-8"));
  } catch (e) {
    return `the SPDX License List could not be read: ${(e as Error).message}`;
  }
  const parsed = PinnedTerminologySchema.safeParse(raw);
  if (!parsed.success) return `${SPDX_LICENSE_LIST_SNAPSHOT} does not validate: ${parsed.error.issues[0]?.message ?? "invalid"}`;
  if (parsed.data.version !== pin.version)
    return `${SPDX_LICENSE_LIST_SNAPSHOT} is License List ${parsed.data.version} but the pin says ${String(pin.version)}: re-run pin-spdx-license-list`;
  return spdxLicenseListOf(parsed.data.version, parsed.data.concepts);
}

/** What checking one expression found. `problem` set means the expression is not valid. */
export interface ExpressionCheck {
  problem?: string;
  /** Listed ids the edition marks deprecated, canonical spelling. */
  deprecated: string[];
  /** Ids written in a case other than the list's, as `[written, canonical]`. Valid; reported. */
  recased: [string, string][];
}

const IDSTRING = "[A-Za-z0-9.-]+";
const LICENSE_REF = new RegExp(`^(DocumentRef-${IDSTRING}:)?LicenseRef-${IDSTRING}$`);
const ADDITION_REF = new RegExp(`^(DocumentRef-${IDSTRING}:)?AdditionRef-${IDSTRING}$`);
const OPERATORS = new Set(["AND", "and", "OR", "or", "WITH", "with"]);

/** Split into terms, operators and parentheses. Whitespace separates; parentheses are their own tokens. */
function tokens(expr: string): string[] {
  return expr.replace(/[()]/g, (p) => ` ${p} `).trim().split(/\s+/).filter(Boolean);
}

/** Check `expr` against `list`. Pure. */
export function checkLicenceExpression(expr: string, list: SpdxLicenseList): ExpressionCheck {
  const out: ExpressionCheck = { deprecated: [], recased: [] };
  if (/[\r\n]/.test(expr)) return { ...out, problem: "a licence expression is one line" };
  const t = tokens(expr);
  if (t.length === 0) return { ...out, problem: "empty licence expression" };
  let i = 0;
  const fail = (m: string): never => {
    throw new Error(m);
  };
  const isOp = (tok: string | undefined, op: string) => tok === op || tok === op.toLowerCase();
  const lookup = (tok: string, table: SpdxLicenseList["licenses"], what: string) => {
    const hit = table.get(tok.toLowerCase());
    if (!hit) fail(`${JSON.stringify(tok)} is not ${what} on SPDX License List ${list.version} (nor a LicenseRef-)`);
    if (hit!.id !== tok) out.recased.push([tok, hit!.id]);
    if (hit!.deprecated) out.deprecated.push(hit!.id);
  };
  const simple = (): void => {
    const tok = t[i++];
    if (tok === undefined) fail("the expression ends where a licence was expected");
    if (tok === "(" || tok === ")" || OPERATORS.has(tok!)) fail(`${JSON.stringify(tok)} where a licence was expected`);
    if (/^[A-Za-z]+$/.test(tok!) && OPERATORS.has(tok!.toUpperCase()) && !OPERATORS.has(tok!))
      fail(`operator ${JSON.stringify(tok)} must be all upper or all lower case`);
    if (LICENSE_REF.test(tok!)) return;
    if (tok!.startsWith("LicenseRef-") || tok!.startsWith("DocumentRef-")) fail(`${JSON.stringify(tok)} is not a well-formed LicenseRef`);
    lookup(tok!.endsWith("+") ? tok!.slice(0, -1) : tok!, list.licenses, "a licence id");
  };
  const addition = (): void => {
    const tok = t[i++];
    if (tok === undefined) fail("`WITH` is not followed by an exception");
    if (ADDITION_REF.test(tok!)) return;
    lookup(tok!, list.exceptions, "an exception id");
  };
  const primary = (): void => {
    if (t[i] === "(") {
      i++;
      or();
      if (t[i++] !== ")") fail("an opening parenthesis is not closed");
      if (isOp(t[i], "WITH")) fail("`WITH` applies to a single licence, not to a parenthesised expression");
      return;
    }
    simple();
    if (isOp(t[i], "WITH")) {
      i++;
      addition();
    }
  };
  const and = (): void => {
    primary();
    while (isOp(t[i], "AND")) {
      i++;
      primary();
    }
  };
  const or = (): void => {
    and();
    while (isOp(t[i], "OR")) {
      i++;
      and();
    }
  };
  try {
    or();
    if (i < t.length) {
      const tok = t[i]!;
      if (/^(and|or|with)$/i.test(tok)) fail(`operator ${JSON.stringify(tok)} must be all upper or all lower case`);
      fail(tok === ")" ? "a closing parenthesis has no opening one" : `unexpected ${JSON.stringify(tok)}: licences must be joined by AND, OR or WITH`);
    }
  } catch (e) {
    return { ...out, problem: (e as Error).message };
  }
  return out;
}
