/**
 * What an IG reader in this layer may read in an IG repository.
 *
 * @module fhir-harness/scripts/ig-read-scope
 *
 * The owner, 2026-10-30T12:41Z: "a harness can point to a repo, but doesnt
 * want to automatically slurpo up all content in a repo. harness desclares
 * what it it pays attention to in the repo." A repository says what that is
 * with `contentTypes.ig.include` in its root `index.config.json`
 * (`schemas/ig-content-type.ts`). This module turns that declaration into the
 * one question every IG reader here asks before it touches a path.
 *
 * ## Three cases
 *
 * - **Declared.** {@link IgReadScope.declares} is `igDeclares`, and
 *   {@link IgReadScope.path} refuses an undeclared path with
 *   `assertIgDeclares`. A reader treats an undeclared optional directory
 *   (`input/images/`, say) as absent, and refuses an undeclared file it
 *   cannot work without (`sushi-config.yaml`).
 * - **Legacy.** The repository has no `contentTypes.ig`. The IGs that predate
 *   the section keep working as they did: every path is readable. One
 *   warning per repository per process names the missing declaration, so
 *   the gap is visible and not silent.
 * - **Unusable.** The section is there but has no `include`, an empty one, or
 *   a bad entry. {@link igReadScope} throws. A section that declares nothing
 *   is never read as "everything".
 *
 * ## Usage
 *
 * This is a library, not a command. A reader asks it once per repository:
 *
 * ```ts
 * import { igReadScope } from "./ig-read-scope.ts";
 * const scope = igReadScope(repoRoot);          // warns once if legacy, throws if unusable
 * if (scope.declares("input/images/")) { ... }  // an undeclared optional path reads as absent
 * const cfg = scope.path("sushi-config.yaml");  // refuses an undeclared required path
 * ```
 *
 * The skill that says how a repository declares and extends the list is
 * `skills/fhir-ig-base/ig-build-pipeline.md` §"What this layer reads".
 *
 * ## What is not gated
 *
 * `index.config.json` itself: reading the declaration is how the scope is
 * known. And the IG's input digest in `ig-ast.ts`: it must equal the Java
 * exporter's `InputDigest` byte for byte, and it names what SUSHI and the
 * Publisher read, which the list does not bound ("The list bounds the
 * harness, not those tools", `schemas/ig-content-type.ts`).
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  assertIgDeclares,
  igDeclares,
  readIgSection,
  type IgSection,
} from "../schemas/ig-content-type.ts";
import { INDEX_SECTION_FILE } from "@litlfred/cat-harness-tools/schemas/content/content-type.js";

/** The paths an IG reader may read in one repository. */
export interface IgReadScope {
  /** The repository root, absolute. */
  root: string;
  /** The declaration; `undefined` on the legacy path. */
  section?: IgSection;
  /** True when the repository declares no `contentTypes.ig`. */
  legacy: boolean;
  /** Whether `rel` (repository-relative, POSIX) may be read. */
  declares(rel: string): boolean;
  /**
   * Whether anything under the directory `rel` may be read: it is declared
   * itself, or an `include` entry lies inside it. A walk descends only into
   * directories this answers yes for, and reads only files {@link declares}
   * answers yes for.
   */
  reaches(rel: string): boolean;
  /** The absolute path of `rel`. Throws when `rel` is not declared. */
  path(rel: string): string;
}

/** The warning a legacy IG gets, once per repository per process. */
export function legacyWarning(root: string): string {
  return (
    `warning: ${root} declares no contentTypes.ig in its ${INDEX_SECTION_FILE}, so fhir-harness reads it as a legacy IG ` +
    `(every path). Declare "contentTypes": { "ig": { "include": [...] } } there, listing the paths the harness reads ` +
    `(see fhir-harness schemas/ig-content-type.ts).`
  );
}

const warned = new Set<string>();

/** Forget which repositories were warned about. For tests. */
export function resetLegacyWarnings(): void {
  warned.clear();
}

const norm = (rel: string): string => rel.split("\\").join("/").replace(/^\.\//, "").replace(/\/+$/, "");

/**
 * The read scope of the IG repository at `root`.
 *
 * `warn` receives the legacy warning (default `console.error`), once per
 * resolved root per process.
 */
export function igReadScope(root: string, opts: { warn?: (s: string) => void } = {}): IgReadScope {
  const abs = resolve(root);
  const read = readIgSection(abs);
  if (read === undefined) {
    if (!warned.has(abs)) {
      warned.add(abs);
      (opts.warn ?? ((s: string) => console.error(s)))(legacyWarning(abs));
    }
    return {
      root: abs,
      legacy: true,
      declares: () => true,
      reaches: () => true,
      path: (rel) => join(abs, rel),
    };
  }
  if ("problems" in read) {
    throw new Error(
      `${abs}: contentTypes.ig in ${INDEX_SECTION_FILE} declares nothing usable, and is not read as "everything": ${read.problems.join("; ")}`,
    );
  }
  const section = read.section;
  return {
    root: abs,
    section,
    legacy: false,
    declares: (rel) => igDeclares(section, norm(rel)),
    reaches: (rel) => {
      const r = norm(rel);
      if (r === "") return true;
      return igDeclares(section, r) || section.include.some((e) => e.startsWith(`${r}/`));
    },
    path: (rel) => {
      assertIgDeclares(section, norm(rel));
      return join(abs, rel);
    },
  };
}

/**
 * Copy what a declared scope covers into `dest`: its `index.config.json`, so
 * the copy still carries the declaration, and each `include` entry that
 * exists. Returns the entries copied. Refuses a legacy scope, which declares
 * no list to copy by.
 */
export function copyDeclared(scope: IgReadScope, dest: string): string[] {
  if (scope.legacy || !scope.section) throw new Error(`${scope.root} declares no contentTypes.ig: there is no include list to copy by`);
  const out: string[] = [];
  for (const e of [INDEX_SECTION_FILE, ...scope.section.include]) {
    const rel = e.replace(/\/+$/, "");
    if (!existsSync(join(scope.root, rel))) continue;
    mkdirSync(dirname(join(dest, rel)), { recursive: true });
    cpSync(join(scope.root, rel), join(dest, rel), { recursive: true });
    out.push(e);
  }
  return out;
}

/**
 * Whether every file under the scope's root is declared (or is the
 * declaration itself): a copy {@link copyDeclared} made, say. A legacy scope
 * declares everything, so it answers yes.
 */
export function onlyDeclared(scope: IgReadScope): boolean {
  if (scope.legacy) return true;
  const walk = (rel: string): boolean => {
    for (const e of readdirSync(join(scope.root, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (scope.declares(r)) continue;
        if (!scope.reaches(r) || !walk(r)) return false;
      } else if (r !== INDEX_SECTION_FILE && !scope.declares(r)) return false;
    }
    return true;
  };
  return walk("");
}
