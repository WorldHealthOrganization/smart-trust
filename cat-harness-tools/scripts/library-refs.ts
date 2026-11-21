/**
 * Who references a library slug — the L1 property, demonstrated rather than asserted.
 *
 * @module scripts/library-refs
 *
 * `library/` is L1: every knowledge-graph reference to a source resolves
 * THROUGH it, never to a loose path or a bare URL. This scans the corpus for
 * those edges, and the viewer shows them.
 *
 * ## The referrer kind is READ, never listed
 *
 * A reference is a `libraryId` field, and what KIND of thing carries it is the
 * **declared graph typology of the directory the file sits in** — `catalogue` for
 * a catalogue node, `voices` for a voice. Nothing here enumerates those two, so
 * a new graph typology that names library slugs appears in this scan the day
 * it is declared (the same "derived, never listed" rule `recordsWork` follows).
 *
 * ## A rendering of an artefact is not the artefact
 *
 * Site output is skipped. `docs/assets/…` holds published *copies* of the
 * catalogue and of this very projection, so counting them would make a slug
 * look referenced because it is on a page about being referenced.
 *
 * ## Zero and unknown are different answers
 *
 * A slug nothing references is a real and reportable finding: the L1 claim is
 * **not** demonstrated for it. A file that could not be parsed is not evidence
 * of anything, so it is collected separately and named, and an unreadable
 * corpus never renders as one with no references.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** One directory to scan, and what kind of thing lives in it. */
export interface RefSource {
  /** The declared graph typology — used verbatim as the referrer's kind. */
  kind: string;
  /** The layer whose declaration named this directory. */
  instance: string;
  /** Absolute path. */
  dir: string;
}

/** One file's references to one slug. */
export interface LibraryRef {
  kind: string;
  instance: string;
  /** Repo-relative path of the file carrying the reference. */
  from: string;
  /**
   * How many times this file names the slug.
   *
   * A voice names its source once in `sources[]` and again on every rule, so
   * the count is a measure of how much of that file rests on the slug. One
   * file is still one referrer; the count is not a second referrer.
   */
  count: number;
}

export interface RefScan {
  /** Slug → the files that reference it, sorted by path. */
  bySlug: Record<string, LibraryRef[]>;
  /** How many JSON files were read. Context for a zero. */
  filesRead: number;
  /**
   * Files that exist and could not be parsed, repo-relative and sorted.
   *
   * NON-EMPTY MEANS THE SCAN IS INCOMPLETE. A consumer that reports "nothing
   * references this slug" without saying so is reporting a conclusion it did
   * not reach.
   */
  unreadable: string[];
}

/** Every `libraryId` string value anywhere in a parsed JSON value. */
export function libraryIdsIn(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) libraryIdsIn(v, out);
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "libraryId" && typeof v === "string" && v.length > 0) out.push(v);
      else libraryIdsIn(v, out);
    }
  }
  return out;
}

/** `*.json` under `dir`, recursively, skipping every dot-prefixed segment. */
function jsonFilesIn(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir).sort()) {
    // The dot-prefix rule, on EVERY segment — `directory-conventions`.
    if (e.startsWith(".")) continue;
    const p = join(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) jsonFilesIn(p, out);
    else if (e.endsWith(".json")) out.push(p);
  }
  return out;
}

/**
 * Scan the given directories for references to library slugs.
 *
 * Sources are supplied rather than discovered here: resolving which
 * directories a declaration names needs the schema layer, and this module is
 * the part a test can hand a temporary tree.
 */
export function scanLibraryRefs(sources: readonly RefSource[], repoRoot: string): RefScan {
  const bySlug: Record<string, LibraryRef[]> = {};
  const unreadable: string[] = [];
  let filesRead = 0;
  const seen = new Set<string>();

  for (const s of sources) {
    for (const file of jsonFilesIn(s.dir)) {
      // A directory can be named by two declarations; a file is read once.
      if (seen.has(file)) continue;
      seen.add(file);
      const rel = relative(repoRoot, file).split(sep).join("/");
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(file, "utf-8"));
      } catch {
        unreadable.push(rel);
        continue;
      }
      filesRead++;
      const counts = new Map<string, number>();
      for (const id of libraryIdsIn(parsed)) counts.set(id, (counts.get(id) ?? 0) + 1);
      for (const [slug, count] of counts) {
        (bySlug[slug] ??= []).push({ kind: s.kind, instance: s.instance, from: rel, count });
      }
    }
  }

  for (const refs of Object.values(bySlug)) refs.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  return { bySlug, filesRead, unreadable: unreadable.sort() };
}
