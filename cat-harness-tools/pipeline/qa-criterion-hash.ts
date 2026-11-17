/**
 * Per-criterion checker hashing.
 *
 * ## Why this exists
 *
 * `computeCriterionScriptHashes` used to record `script_hash` as the hash of
 * the WHOLE checker source file. The freshness gate (`entryIsFresh`) treats a
 * changed `script_hash` as "this verdict was produced by a different checker,
 * re-run it", so a whole-file hash means:
 *
 *   editing ONE criterion invalidates EVERY criterion defined in that file,
 *   across EVERY block in the corpus.
 *
 * Checker files are large and multi-criterion — `qa-checkers-extended.ts`
 * defines 40 criteria, `qa-checkers-voice.ts` 10 — so a one-line fix to one
 * checker rewrote thousands of sidecar entries whose verdicts had not changed
 * and could not have changed. In qou that churn grew large enough that no
 * feature branch could carry it: PRs #4843, #4596 and #4597 each had to revert
 * 18-408 files of it, so the provenance was never committed, so the drift grew.
 *
 * Hashing each criterion over only the code it can actually reach fixes this at
 * the source. An unchanged criterion keeps its hash, stays `fresh-skip`, and its
 * sidecar entry is never rewritten — which also means `script_commit_sha` and
 * `reviewed_at` stop churning, without any schema change.
 *
 * ## What is hashed
 *
 * The criterion's dispatch entry — the FIRST property in this module whose key
 * is the criterion id, in any object literal, at any depth. The record's name
 * is irrelevant and so is whether it is exported: `findCriterionEntry` matches
 * on the key alone, so a dispatch table called anything at all is found, and a
 * property with that key somewhere else would be found first. (An earlier
 * version of this paragraph claimed the analysis locates an exported
 * `*_AUTOMATED_CHECKERS` record; it never has, and reading it that way sends
 * you looking for a naming convention that is not load-bearing.)
 *
 * That entry, plus the transitive closure of module-local
 * declarations it references. Cross-module imports are NOT followed — that
 * matches the previous whole-file behaviour, which never hashed other files
 * either, so this is not a new gap. Declared `extra_inputs` remain covered
 * separately by `deps_hash`.
 *
 * ## Failure mode is deliberately one-directional
 *
 * A hash that is too NARROW is dangerous: it silently keeps a stale verdict
 * that a checker change should have invalidated. A hash that is too WIDE only
 * costs churn. So every uncertain path here returns `null` and the caller falls
 * back to the whole-file hash — over-invalidate, never under-invalidate.
 *
 * ## Coverage, and what still falls back
 *
 * 50 of the 66 automated criteria resolve per-criterion. The two files with the
 * worst fan-out are the ones this fixes: `qa-checkers-extended.ts` (34 of 41)
 * and `qa-checkers-voice.ts` (10 of 10).
 *
 * The 16 that fall back do so for a structural reason worth recording: the
 * analysis looks for the dispatch entry inside the criterion's declared
 * `source_file`, and for some criteria the dispatch lives in a different module
 * from the checker logic. The 9 `qa-checkers-python.ts` criteria are dispatched
 * from `script-sweep.ts`, so their entry is not in the file being hashed. They
 * keep whole-file behaviour — no regression, and their mutual invalidation is
 * contained to those 9. Teaching the analysis to follow a dispatcher in another
 * module would close that gap; it is not needed for the churn this fixes.
 */

import { readFileSync } from "fs";
import { createHash } from "crypto";
import ts from "typescript";

/** `file path + criterion id` -> hash (or null when analysis was inconclusive). */
const cache = new Map<string, string | null>();

/** Source text keyed by absolute path, so each checker file parses once. */
const parsed = new Map<string, ts.SourceFile | null>();

function parseFile(absPath: string): ts.SourceFile | null {
  if (parsed.has(absPath)) return parsed.get(absPath)!;
  let sf: ts.SourceFile | null = null;
  try {
    const text = readFileSync(absPath, "utf-8");
    sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.ESNext, true);
  } catch {
    sf = null;
  }
  parsed.set(absPath, sf);
  return sf;
}

/**
 * Map every top-level declaration in the module to its source text, by name.
 * Covers the declaration kinds a checker can reference: functions, `const`/`let`
 * bindings (including the dispatch records themselves), classes, enums, and the
 * type-side declarations that can appear in a checker's signature.
 */
function topLevelDeclarations(sf: ts.SourceFile): Map<string, ts.Node[]> {
  const decls = new Map<string, ts.Node[]>();
  const add = (name: string, node: ts.Node) => {
    const prior = decls.get(name);
    if (prior) prior.push(node);
    else decls.set(name, [node]);
  };

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      add(stmt.name.text, stmt);
    } else if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) add(d.name.text, d);
        // Destructuring bindings are not resolvable to a single decl; skip
        // them. A checker referencing one falls back to the file hash via the
        // unresolved-identifier path below.
      }
    } else if (
      (ts.isClassDeclaration(stmt) ||
        ts.isInterfaceDeclaration(stmt) ||
        ts.isTypeAliasDeclaration(stmt) ||
        ts.isEnumDeclaration(stmt)) &&
      stmt.name
    ) {
      add(stmt.name.text, stmt);
    }
  }
  return decls;
}

/**
 * Locate a criterion's dispatch entry: a property whose key is `criterionId`
 * inside an object literal in this module. Criterion ids are hyphenated, so the
 * key is normally a string literal, but identifier and computed-constant keys
 * are handled too.
 */
function findCriterionEntry(
  sf: ts.SourceFile,
  criterionId: string,
): ts.Node | null {
  let found: ts.Node | null = null;

  const keyText = (name: ts.PropertyName): string | null => {
    if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
      return name.text;
    }
    if (ts.isIdentifier(name)) return name.text;
    return null;
  };

  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isPropertyAssignment(node) && keyText(node.name) === criterionId) {
      found = node;
      return;
    }
    // A shorthand property (`{ "x": x }` written as `{ x }`) cannot carry a
    // hyphenated criterion id, so there is nothing to match there.
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sf, visit);
  return found;
}

/**
 * Walk the closure of module-local declarations reachable from `root`.
 *
 * Returns `null` when the closure cannot be trusted — currently only when the
 * recursion exceeds `MAX_DECLS`, which would indicate the analysis has latched
 * onto something far larger than a single checker. Unresolved identifiers
 * (imports, globals, locals, property names) are simply not module-local and
 * are skipped; that is the normal case, not a failure.
 */
function closure(
  root: ts.Node,
  decls: Map<string, ts.Node[]>,
): Map<string, ts.Node[]> | null {
  const MAX_DECLS = 400;
  const reached = new Map<string, ts.Node[]>();
  const queue: ts.Node[] = [root];

  while (queue.length) {
    const node = queue.pop()!;
    const visit = (n: ts.Node) => {
      // Property ACCESS names (`foo.bar`) are not module-level references —
      // only the object expression is. Skip the name side so `p.md` does not
      // spuriously resolve to a top-level `md`.
      if (ts.isPropertyAccessExpression(n)) {
        visit(n.expression);
        return;
      }
      // Object literal KEYS are not references either.
      if (ts.isPropertyAssignment(n)) {
        visit(n.initializer);
        return;
      }
      if (ts.isIdentifier(n)) {
        const target = decls.get(n.text);
        if (target && !reached.has(n.text)) {
          if (reached.size >= MAX_DECLS) throw new Error("closure too large");
          reached.set(n.text, target);
          for (const t of target) queue.push(t);
        }
        return;
      }
      ts.forEachChild(n, visit);
    };
    try {
      ts.forEachChild(node, visit);
    } catch {
      return null;
    }
  }
  return reached;
}

/**
 * Hash of everything the criterion's checker can reach inside its own module,
 * or `null` when the analysis was inconclusive and the caller should fall back
 * to hashing the whole file.
 *
 * `absPath` is the checker source file; `criterionId` the registry id.
 */
export function criterionSourceHash(
  absPath: string,
  criterionId: string,
): string | null {
  const key = `${absPath}\0${criterionId}`;
  if (cache.has(key)) return cache.get(key)!;

  const result = ((): string | null => {
    const sf = parseFile(absPath);
    if (!sf) return null;

    const entry = findCriterionEntry(sf, criterionId);
    // Not every registered criterion is dispatched from its declared
    // `source_file` (some are non-automated, some are dispatched elsewhere).
    // Those keep the whole-file hash.
    if (!entry) return null;

    const decls = topLevelDeclarations(sf);
    const reached = closure(entry, decls);
    if (!reached) return null;

    // Sort by name so the hash is independent of declaration order and of the
    // traversal order, which is not stable.
    const parts = [`@entry\0${entry.getText(sf)}`];
    for (const name of [...reached.keys()].sort()) {
      for (const node of reached.get(name)!) {
        parts.push(`${name}\0${node.getText(sf)}`);
      }
    }
    return createHash("sha256").update(parts.join("\n\0\n")).digest("hex").slice(0, 12);
  })();

  cache.set(key, result);
  return result;
}

/** Test seam: drop memoized parses and hashes. */
export function _resetCriterionHashCache(): void {
  cache.clear();
  parsed.clear();
}
