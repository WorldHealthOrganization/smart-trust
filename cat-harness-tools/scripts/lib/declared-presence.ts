/**
 * Split DECLARED directories into those on disk and those not — and say so.
 *
 * Bean `95ir`. A scanner that ends its resolution with `.filter(existsSync)`
 * drops a declared-but-absent library without a word, then reports a clean run
 * over the libraries that remain: the `dh4f` shape, one step removed.
 *
 * The owner's ruling, 2026-09-23: **fail in CI for declarations, not for
 * instances.** The DECLARATION half is `check:declared-dirs`, which runs in CI
 * and fails on every declared directory not on disk (verified by moving
 * a content layer's `library/` away: `absent — declared and not on disk`, exit 1). A
 * SCANNER is the layer half and must not fail on it — a new folio's library
 * is absent until its first ingest — but it must not be silent either. So an
 * absent directory is reported here, in its own words, distinct from "empty":
 * an empty directory that exists is a determined empty; a declared path with
 * nothing there is a different fact.
 */
import { existsSync } from "node:fs";

export interface DeclaredPresence { present: string[]; absent: string[] }

export function splitDeclared(dirs: readonly string[], exists: (p: string) => boolean = existsSync): DeclaredPresence {
  const present: string[] = [];
  const absent: string[] = [];
  for (const d of dirs) (exists(d) ? present : absent).push(d);
  return { present, absent };
}

/** Said once per process: a scanner may resolve the same library from two call sites. */
const alreadySaid = new Set<string>();

/** One line per absent directory, to stderr: a note, never a failure. */
export function noteAbsent(absent: readonly string[], what: string, log: (s: string) => void = console.error): void {
  for (const d of absent) {
    if (alreadySaid.has(d)) continue;
    alreadySaid.add(d);
    log(`  · ${what} declared at ${d} is not on disk — skipped here, NOT read as empty. ` +
      "`check:declared-dirs` fails CI on a declared directory that is missing.");
  }
}
