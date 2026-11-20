/**
 * The QA checker for criterion `recommendation-strength-resolves` (bean
 * `55ao`): a `recommendation` block's `strength` names an active code in a
 * code list its folio can see. The rule itself — what "resolves" means — is
 * `strengthFinding` in `schemas/recommendation-strength.ts`.
 *
 * Here and not in `schemas/` because a checker a layer CONTRIBUTES is named by
 * its `qa-checkers/` node and loaded through the harness's `imports`
 * input-site, which admits `<instance>/pipeline/qa-checkers-*.ts` only — the
 * place the science layer's cost checkers and the DAK layer's checkers already are.
 *
 * @module folio-assistant-core/pipeline/qa-checkers-recommendation
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";

import type { CheckerPaths, CheckerResult } from "@litlfred/cat-harness-tools/schemas/sdlc/block-qa.js";
import { loadCodeLists } from "@litlfred/cat-harness-tools/schemas/library/code-list.js";
import { maskStringsAndComments, parseStringField } from "@litlfred/cat-harness-tools/pipeline/uses-field.js";
import { strengthFinding } from "../schemas/recommendation-strength.js";

/** Core's own code-lists, which every folio using the `recommendation` kind depends on. */
const CORE_CODE_LISTS = join(import.meta.dir, "..", "code-lists");

/**
 * The code lists a block can see, in overlay order: core's first, then every
 * `code-lists/` from the filesystem root down to the block's directory. The
 * nearest wins on an id collision, as `codeListDirs` orders a dependency
 * tree (deepest first, the layer last). Read from the filesystem, not the
 * declaration graph, because a checker is synchronous and runs per block.
 */
export function codeListDirsFor(file: string): string[] {
  const up: string[] = [];
  for (let d = dirname(file); ; d = dirname(d)) {
    const candidate = join(d, "code-lists");
    if (existsSync(candidate) && candidate !== CORE_CODE_LISTS) up.push(candidate);
    if (d === parse(d).root) break;
  }
  return [CORE_CODE_LISTS, ...up.reverse()];
}

/**
 * The `strength: { list, code }` a manifest declares, read as TEXT: the
 * manifest is never executed, as every sweep reads manifests. `undefined` when
 * there is none; `null` when there is one but it is not two string fields
 * (a computed value cannot be checked, and is said so rather than passed).
 */
export function strengthOf(src: string): { list: string; code: string; line: number } | null | undefined {
  const masked = maskStringsAndComments(src);
  const m = /(^|[{,\s])strength\s*:\s*\{/.exec(masked);
  if (!m) return undefined;
  const open = m.index + m[0].length - 1;
  let depth = 0;
  let close = -1;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === "{") depth++;
    else if (masked[i] === "}" && --depth === 0) { close = i; break; }
  }
  if (close < 0) return null;
  const body = src.slice(open, close + 1);
  const list = parseStringField(body, "list");
  const code = parseStringField(body, "code");
  if (list === undefined || code === undefined) return null;
  return { list, code, line: src.slice(0, m.index).split("\n").length };
}

/**
 * Criterion `recommendation-strength-resolves`: a recommendation's
 * `strength` names an active code in a code list its folio can see.
 * `n/a` when the block declares no strength (the field is optional) or its
 * manifest cannot be read; `warn` when the strength is not two string literals.
 */
export function checkRecommendationStrengthResolves(paths: CheckerPaths): CheckerResult {
  const ts = paths.ts;
  if (!ts || !existsSync(ts)) return { result: "n/a", hits: [], notes: "no manifest to read" };
  const src = readFileSync(ts, "utf-8");
  const s = strengthOf(src);
  if (s === undefined) return { result: "n/a", hits: [], notes: "no strength declared; the field is optional" };
  if (s === null) {
    return { result: "warn", hits: [{ file: ts, line: 1, text: "strength is not two string literals" }], notes: "strength could not be read as text, so it was not checked" };
  }
  const finding = strengthFinding({ list: s.list, code: s.code }, loadCodeLists(codeListDirsFor(ts)));
  if (finding === null) return { result: "pass", hits: [] };
  return { result: "fail", hits: [{ file: ts, line: s.line, text: finding }] };
}

/** The dispatch table `qa-checkers/recommendation-strength-resolves.json` names. */
export const RECOMMENDATION_CHECKERS: Record<string, (paths: CheckerPaths) => CheckerResult> = {
  "recommendation-strength-resolves": (p) => checkRecommendationStrengthResolves(p),
};
