/**
 * Path classes for the merge pipeline: which changed paths are GENERATED,
 * which are generated REGIONS inside authored files, and which are AUTHORED,
 * plus the shared declarations two otherwise independent PRs can collide on.
 *
 * @module scripts/merge-pipeline-paths
 * @graphNode none — a classifier, read by `merge-train.ts`, `merge-overlap.ts` and `merge-leftover.ts`
 *
 * ## Generated is read from the declaration, never listed here
 *
 * The generated paths are the ones `merge-conflict-patterns.ts` declares a
 * resolving strategy for: `take-base` and `owned-tree` are wholly generated,
 * and `generated-regions` is authored prose with generator-owned regions.
 * Everything else, including a path no pattern names, is AUTHORED. A second
 * list here could drift from the one `merge:main` acts on.
 *
 * ## Shared declarations ARE listed here, with reasons
 *
 * This table is the one home of the T3 rule: a file many PRs edit and whose
 * concurrent edits interact. Each entry says why it is shared.
 */
import { classify, type ConflictPattern } from "./merge-conflict-patterns.ts";

/** What a changed path is, for the merge pipeline. */
export type PathClass = "generated" | "generated-regions" | "authored";

/** One classified path, with the pattern that decided it when one did. */
export interface ClassifiedPath {
  path: string;
  class: PathClass;
  /** The `merge-conflict-patterns` id, when a pattern named the path. */
  pattern?: string;
}

/** Classify a path from the declared merge-conflict patterns. */
export function pathClass(path: string, patterns?: readonly ConflictPattern[]): ClassifiedPath {
  const c = patterns ? classify(path, patterns) : classify(path);
  const pattern = c.pattern?.id;
  const cls: PathClass =
    c.strategy === "take-base" || c.strategy === "owned-tree"
      ? "generated"
      : c.strategy === "generated-regions"
        ? "generated-regions"
        : "authored";
  return pattern === undefined ? { path, class: cls } : { path, class: cls, pattern };
}

/** A file many PRs edit, where concurrent edits interact even without a textual conflict. */
export interface SharedDeclaration {
  id: string;
  /** Repo-relative globs (Bun.Glob syntax), or a matcher for shapes a glob cannot say. */
  globs: string[];
  match?: (path: string) => boolean;
  why: string;
}

/**
 * A layer declaration: `<dir>/<dir>.json`, e.g. `cat-harness/cat-harness.json`.
 * The layer's own name is the file name, so no glob can say it.
 */
export function isInstanceDeclaration(path: string): boolean {
  const m = /^(?:.*\/)?([^/]+)\/([^/]+)\.json$/.exec(path);
  return m !== null && m[1] === m[2];
}

export const SHARED_DECLARATIONS: readonly SharedDeclaration[] = [
  {
    id: "instance-declaration",
    globs: [],
    match: isInstanceDeclaration,
    why: "an instance's `<instance>.json`: every declared directory, graph typology and tile, so two PRs adding entries interact even when their hunks do not overlap",
  },
  {
    id: "roles",
    globs: ["**/roles.json"],
    why: "the role declarations every BPMN lane binds; a role renamed on one side breaks the other side's lanes",
  },
  {
    id: "package-json",
    globs: ["package.json", "**/package.json"],
    why: "scripts and dependencies: the gate set is derived from scripts the workflow names, and two added scripts collide in one JSON object",
  },
  {
    id: "lockfile",
    globs: ["bun.lock", "**/bun.lock"],
    why: "the dependency lockfile; concurrent dependency changes must be re-resolved together, never merged textually",
  },
  {
    id: "schemas",
    globs: ["**/schemas/**"],
    why: "the Zod schemas every validator, generator and gate reads; a schema change re-judges files the other PR touched",
  },
  {
    id: "processes",
    globs: ["**/processes/**/*.bpmn", "**/*.dmn"],
    why: "executable BPMN and DMN; a diagram change re-routes what the other PR's workflow instances do (requirements T3)",
  },
];

/** The shared declarations `path` is, by id; empty when it is none. */
export function sharedDeclarationsOf(path: string, decls: readonly SharedDeclaration[] = SHARED_DECLARATIONS): string[] {
  return decls
    .filter((d) => d.globs.some((g) => new Bun.Glob(g).match(path)) || (d.match?.(path) ?? false))
    .map((d) => d.id);
}

const REGION_BEGIN = /^\s*<!--\s*([a-z0-9][a-z0-9:_-]*):begin\s*-->\s*$/i;
const REGION_END = /^\s*<!--\s*([a-z0-9][a-z0-9:_-]*):end\s*-->\s*$/i;

/**
 * The authored text of a file with generated regions: every line between a
 * `<!-- x:begin -->` and its `<!-- x:end -->` is dropped, the markers kept.
 * Two versions whose stripped forms are equal differ only where a generator
 * writes. An unclosed region keeps everything after the marker, so a broken
 * file never reads as region-only.
 */
export function stripGeneratedRegions(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let open: string | undefined;
  for (const line of lines) {
    if (open === undefined) {
      out.push(line);
      open = REGION_BEGIN.exec(line)?.[1];
      continue;
    }
    // Inside a region: drop everything up to ITS end marker. A different
    // region's end marker is content, not a boundary.
    if (REGION_END.exec(line)?.[1] === open) {
      out.push(line);
      open = undefined;
    }
  }
  // Unclosed: compare the whole text, so a broken file never reads as region-only.
  return open === undefined ? out.join("\n") : text;
}

/** Whether two versions of a file differ only inside generated regions. */
export function differsOnlyInRegions(a: string, b: string): boolean {
  return stripGeneratedRegions(a) === stripGeneratedRegions(b);
}
