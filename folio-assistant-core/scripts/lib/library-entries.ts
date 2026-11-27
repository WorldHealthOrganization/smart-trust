/**
 * The entries of a library directory, flat or filed in a concern group —
 * bean `folio-assistant-6fez`, placement ruling 3 (2026-09-30, option A).
 *
 * The harness files its sources at `library/<group>/<slug>/` and declares the
 * groups in `library/library.json` (`concern-groups/v1`). A new upload still
 * lands unfiled at `library/<slug>/`, so a library holds both layouts. A
 * reader that lists `library/*` one level deep would take a group for an entry
 * and miss everything filed in it.
 *
 * This is the same answer as `libraryEntryDirs` in cat-harness-tools
 * (`scripts/lib/library-entry-graphs.ts`, #1105). It is kept here, small, so
 * that core reads a grouped library at any cat-harness-tools pin. A group is
 * told from an entry only by the library's own declaration, never by its name.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface LibraryEntry {
  /** The entry's slug: its directory name, and the identity its ids are minted from. */
  slug: string;
  /** The entry's directory. */
  dir: string;
  /** The concern group it is filed in, when it is filed. */
  group?: string;
}

const isDirectory = (p: string): boolean => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/** The group codes `<lib>/library.json` declares, or none. */
export function declaredLibraryGroups(lib: string): Set<string> {
  const f = join(lib, "library.json");
  if (!existsSync(f)) return new Set();
  try {
    const d = JSON.parse(readFileSync(f, "utf8")) as { $schema?: unknown; groups?: unknown };
    if (d.$schema !== "concern-groups/v1" || !Array.isArray(d.groups)) return new Set();
    return new Set(d.groups.filter((g): g is string => typeof g === "string"));
  } catch {
    return new Set();
  }
}

/**
 * Every entry directory of `lib`, flat and filed, sorted by slug in the plain
 * code-unit order `readdirSync().sort()` gives, so a flat library lists as it
 * always did. Empty when `lib` is not a directory. Hidden directories are left
 * out, as the readers here always left them out.
 */
export function libraryEntries(lib: string): LibraryEntry[] {
  if (!isDirectory(lib)) return [];
  const groups = declaredLibraryGroups(lib);
  const out: LibraryEntry[] = [];
  for (const name of readdirSync(lib)) {
    const dir = join(lib, name);
    if (name.startsWith(".") || !isDirectory(dir)) continue;
    if (!groups.has(name)) {
      out.push({ slug: name, dir });
      continue;
    }
    for (const inner of readdirSync(dir)) {
      const d = join(dir, inner);
      if (!inner.startsWith(".") && isDirectory(d)) out.push({ slug: inner, dir: d, group: name });
    }
  }
  const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  return out.sort((a, b) => cmp(a.slug, b.slug) || cmp(a.dir, b.dir));
}

/**
 * The directory of entry `slug` in `lib`: unfiled at `<lib>/<slug>/`, else in
 * the one declared group that holds it, else `undefined`. The lookup a reader
 * makes when it already knows the slug, so it need not list the library.
 */
export function libraryEntryDir(lib: string, slug: string): string | undefined {
  const flat = join(lib, slug);
  if (isDirectory(flat)) return flat;
  for (const g of declaredLibraryGroups(lib)) {
    const d = join(lib, g, slug);
    if (isDirectory(d)) return d;
  }
  return undefined;
}
