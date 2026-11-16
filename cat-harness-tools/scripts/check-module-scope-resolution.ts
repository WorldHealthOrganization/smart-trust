#!/usr/bin/env bun
/**
 * check-module-scope-resolution.ts — no module scope resolves the folio
 * directory, because a throw there is an error far from its cause.
 *
 * Forbidden: `const FOLIO_DIR = folioDir(ROOT);` at module scope. `folioDir`
 * throws on a malformed declaration; a throw during evaluation aborts the
 * module and leaves every later export unbound, so the error a reader sees
 * names an unrelated binding's temporal dead zone, far from the cause.
 *
 * Not flagged:
 * - `findContentRepoRoot()` at module scope: it catches `folioDir` failures
 *   and ends in a declared fallback.
 * - Lazy call sites, e.g. `FOLIO_DIR: () => folioDir(x)` inside an object
 *   (`adapters/document/paths.ts` has one deliberately).
 *
 * The fix a finding points at: `folioDirDeferred(root, import.meta.url)` —
 * resolves at load as before; only the THROW waits for a caller, and names
 * the module.
 *
 * @module scripts/check-module-scope-resolution
 * @covers code
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { layerRootsIn } from "../schemas/kg/cat-harness.js";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");

/**
 * The resolvers that THROW on a declaration that will not parse.
 *
 * `folioDir` was the whole list until 2026-09-21. The other two were found by
 * running them rather than by reading about them — against a directory holding
 * `{ not json`, on main:
 *
 * | `folioDir` | THREW |
 * | `directoryForGraph` | THREW |
 * | `directoriesForGraph` | THREW |
 * | `findContentRepoRoot` | returned its declared fallback |
 *
 * `findContentRepoRoot` stays off the list deliberately, and that is the same
 * decision this gate was created with: it is a SEARCH, every `folioDir` probe
 * inside it is wrapped, and it ends in a declared fallback. A gate against a
 * hazard that does not exist teaches a reader something false.
 */
const THROWING = ["folioDir", "directoryForGraph", "directoriesForGraph"];

/**
 * A module-scope `const|let|export const X = <anything calling one of them>`.
 *
 * `=\s*folioDir\s*\(` was the original, and it only matched a call in the
 * FIRST position. Every real `directoryForGraph` site is
 * `directoryForGraph(root, "x") ?? join(root, "x")` or wrapped in a `join(...)`,
 * so an anchored pattern would have reported a clean file over each of them.
 */
const OFFENDING = new RegExp(
  `^(?:export\\s+)?(?:const|let|var)\\s+\\w+\\s*(?::[^=]*)?=.*\\b(?:${THROWING.join("|")})\\s*\\(`,
);

export interface Finding {
  file: string;
  line: number;
  text: string;
}

export interface ModuleScopeReport {
  filesRead: number;
  findings: Finding[];
  /**
   * `ALLOWED` entries whose file no longer matches. A finding in its own
   * right: the exception outlived its reason, and nothing else would say so.
   */
  stale: string[];
}

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir).map(String);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const abs = join(dir, name);
    let isDir: boolean;
    try {
      isDir = statSync(abs).isDirectory();
    } catch {
      continue;
    }
    if (isDir) walk(abs, out);
    else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) out.push(abs);
  }
}

/**
 * Sites kept, with the reason — and **it is empty**, which is a determined
 * empty rather than an unused mechanism.
 *
 * It held three entries when this gate was widened: `scripts/todos.ts`,
 * `scripts/agent-memory.ts` and `adapters/mcp-server/paths.ts`, whose
 * constants are EXPORTED, so deferring one is a change at every import site
 * rather than in one file. All three are converted now, and the entries went
 * with them.
 *
 * The mechanism stays because the next such case will want it, and because it
 * POLICES ITSELF: an entry whose file no longer matches is reported as stale
 * and to be deleted. An allow-list that keeps an entry after the reason for it
 * is gone stops being a list of known exceptions and becomes a blind spot —
 * the defect this repository has already paid for in
 * `qa-criterion-source-file.test.ts`, where a hardcoded checker list hid three
 * real mismatches.
 */
const ALLOWED: Record<string, string> = {};

/**
 * Is the throwing call already behind an arrow, and therefore deferred?
 *
 * This gate has now been written twice and got this wrong both times, in two
 * different ways, so the rule is stated rather than pattern-matched. The first
 * version flagged `const X = (): string => folioDir(root)`; widening the
 * pattern to reach nested calls then flagged
 * `const X = deferResolution(() => join(folioDir(root), "y"), …)` — the very
 * shape it exists to recommend. A gate that reports its own remedy is worse
 * than no gate, because the only way to satisfy it is to stop using the fix.
 *
 * The discriminator is the ARROW, not the helper's name. A call after `=>`
 * runs when somebody calls the function; a call before it runs while the
 * module is evaluating. Keying on `deferResolution(` instead would bless one
 * spelling and flag an equivalent hand-written one.
 */
function isDeferred(line: string): boolean {
  const call = line.search(new RegExp(`\\b(?:${THROWING.join("|")})\\s*\\(`));
  if (call < 0) return false;
  const arrow = line.indexOf("=>");
  return arrow >= 0 && arrow < call;
}

export function checkModuleScopeResolution(root = REPO_ROOT): ModuleScopeReport {
  const files: string[] = [];
  // EVERY layer, not just `cat-harness`. This walked one directory until
  // 2026-09-21, and on that day the repository grew a contributing layer
  // with pipeline code of its own (the formal-math layer, bean `rfev`) — so a
  // call site there was invisible to a gate reporting a clean run. Reading the
  // layer list rather than naming a second directory, because the next
  // layer would be invisible again.
  // DEDUPED: `layerRootsIn` yields the repository root as a layer in its
  // own right AND each layer directory inside it, so a naive loop walks
  // `cat-harness/**` twice and reports every finding twice. A doubled count is
  // not a harmless cosmetic — it is a number a reader would quote.
  const seen = new Set<string>();
  for (const instance of layerRootsIn(root)) {
    const found: string[] = [];
    walk(instance, found);
    for (const f of found) if (!seen.has(f)) { seen.add(f); files.push(f); }
  }

  const findings: Finding[] = [];
  const allowedSeen = new Set<string>();
  for (const abs of files) {
    const rel = relative(root, abs).split("\\").join("/");
    // This gate's own regex and prose name the pattern; exempting it by path
    // rather than by a marker keeps the rule readable.
    if (rel.endsWith("scripts/check-module-scope-resolution.ts")) continue;
    for (const [i, line] of readFileSync(abs, "utf8").split("\n").entries()) {
      if (!OFFENDING.test(line)) continue;
      if (isDeferred(line)) continue;
      if (rel in ALLOWED) {
        allowedSeen.add(rel);
        continue;
      }
      findings.push({ file: rel, line: i + 1, text: line.trim() });
    }
  }
  const stale = Object.keys(ALLOWED).filter((f) => !allowedSeen.has(f));
  return { filesRead: files.length, findings, stale };
}

export function formatReport(r: ModuleScopeReport): string {
  if (r.filesRead === 0) {
    return "Module-scope resolution\n  ? EXAMINED NOTHING — no TypeScript found. That is not a pass.";
  }
  const out = [`Module-scope resolution (${r.filesRead} file(s))`];
  if (r.findings.length === 0) {
    if (r.stale.length === 0) {
      out.push(`  ✓ no module scope calls ${THROWING.join(", ")} — a malformed`);
      out.push("    declaration cannot abort a module and strand its exports");
      return out.join("\n");
    }
  }
  for (const f of r.findings) {
    out.push(`  ✗ ${f.file}:${f.line}`);
    out.push(`      ${f.text}`);
  }
  out.push("");
  out.push(`  ${THROWING.join(", ")} throw on a malformed declaration, and a`);
  out.push("  throw at module scope");
  out.push("  aborts evaluation — every export below is left unbound and the error");
  out.push("  surfaces somewhere else entirely (bean `95s1`, 3,186 lines away).");
  out.push("");
  if (r.findings.length) {
    out.push("  Use `folioDirDeferred(root, import.meta.url)`: same resolution, at the same");
    out.push("  moment, but the failure waits for a caller and names this module.");
  }
  if (r.stale.length) {
    out.push("");
    out.push("  ALLOWED entries whose file no longer matches — delete them, or the");
    out.push("  exception silences a future regression in a file nobody is watching:");
    for (const f of r.stale) out.push(`    ${f}`);
  }
  return out.join("\n");
}

if (import.meta.main) {
  const report = checkModuleScopeResolution();
  const clean = report.filesRead > 0 && report.findings.length === 0;
  (clean ? console.log : console.error)(formatReport(report));
  process.exit(clean ? 0 : 1);
}
