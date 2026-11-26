/**
 * The `ig` content type: a repository declares itself the source of a FHIR
 * implementation guide with `contentTypes.ig` in its root `index.config.json`.
 *
 * @module fhir-harness/schemas/ig-content-type
 * @graphNode schema
 *
 * ## Why a section, and why here
 *
 * The owner chose the section on 2026-10-30 ("A. ig section in index.config"),
 * in the same form as the other `index.config.json` content-type sections
 * (bean `cz17`, item 3; `IndexSectionMarker` in cat-harness). The
 * rejected alternative was to treat `sushi-config.yaml` as the marker. That
 * file is SUSHI's: it says what SUSHI builds. It does not say which parts of
 * the repository this harness reads.
 *
 * This layer registers the type because an IG is this layer's subject.
 * Core and the harness do not name an IG: the layer that owns the model
 * registers the entry, and a layer that cannot serve it does not name it.
 *
 * ## The section declares what is read, and nothing else is read
 *
 * The owner, 2026-10-30T12:41Z: "a harness can point to a repo, but doesnt
 * want to automatically slurpo up all content in a repo. harness desclares
 * what it it pays attention to in the repo."
 *
 * So `contentTypes.ig` is not a flag. It carries `include`: the
 * repository-relative paths this harness pays attention to. An entry ending in
 * `/` is a directory and covers everything under it. Any other entry is one
 * file. {@link igDeclares} answers whether a path is covered, and
 * {@link assertIgDeclares} refuses one that is not. A section with no
 * `include`, or an empty one, declares nothing: {@link readIgSection} returns
 * its problems, and nothing reads it as "everything".
 *
 * ```json
 * "contentTypes": {
 *   "ig": { "include": ["sushi-config.yaml", "ig.ini", "input/fsh/", "input/pagecontent/"] }
 * }
 * ```
 *
 * The IG Publisher and SUSHI still read what they read. The list bounds the
 * harness, not those tools.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { trustedSvgProblem, trustedScriptProblem } from "./ig-trusted-scripts.ts";

import { defaultContentTypes, INDEX_SECTION_FILE, type ContentTypeRegistry } from "@litlfred/cat-harness-tools/schemas/content/content-type.js";
import { ownNamespace } from "@litlfred/cat-harness-tools/schemas/kg/namespaces.js";

/** The key under `index.config.json` `contentTypes` that declares an IG. */
export const IG_INDEX_SECTION = "ig";

/**
 * The `@type` an `ig` membership projects to.
 *
 * Minted in this layer's IG vocabulary: the membership is this harness's claim about what it reads, and an
 * HL7 IRI would claim an authority it does not have.
 */
export const IG_TYPE = `${ownNamespace("fhir-harness-ig-ast")}IgRepository`;

/** `contentTypes.ig`, as it is written. */
export interface IgSection {
  /** Repository-relative POSIX paths. A trailing `/` marks a directory. */
  include: string[];
  /**
   * Same-site scripts the IG's own pages load, as each page's script `src`
   * writes them (owner, 2026-11-12, cards Q-TRP-3 and Q-RAIL-2). The injection
   * gate (`scripts/ig-content-qa.ts`) accepts, on a page and only there, a
   * script element whose `src` is on this list and that has no body; every
   * other script, and any script in a resource's narrative or markdown, is
   * still refused. Absent means none.
   */
  trustedScripts?: string[];
  /**
   * Same-site SVG drawings the IG's own pages embed with `<object>`, as each
   * element's `data` writes them, so the drawing's links work (owner,
   * 2026-11-12: the onboarding diagrams' drill-down). The injection gate
   * accepts, on a page and only there, an `<object>` opening tag whose `data`
   * is on this list, whose `type` (if any) is `image/svg+xml`, and whose other
   * attributes are presentational (`style`, `width`, `height`, `class`, `id`,
   * `title`, `role`, `aria-*`). The element's body is still scanned. Absent
   * means none.
   */
  trustedSvgs?: string[];
}

/**
 * Why `entry` cannot be an `include` path, or `undefined` when it can.
 *
 * Absolute paths, `..`, `.`, backslashes and empty segments are refused,
 * because each one either leaves the repository or names one place two ways.
 */
export function includeEntryProblem(entry: unknown): string | undefined {
  if (typeof entry !== "string" || entry.length === 0) return "not a non-empty string";
  if (entry.startsWith("/")) return "absolute; include paths are relative to the repository root";
  if (entry.includes("\\")) return "uses a backslash; include paths are POSIX";
  const segs = (entry.endsWith("/") ? entry.slice(0, -1) : entry).split("/");
  if (segs.some((s) => s === "" || s === "." || s === "..")) return "has an empty, `.` or `..` segment";
  return undefined;
}

/**
 * Read `contentTypes.ig` as an {@link IgSection}.
 *
 * Returns `{ problems }` instead when the section is not a usable
 * declaration: no `include`, an empty one, or a bad entry. A section that is
 * there and unusable is not the same as one that is absent.
 */
export function parseIgSection(section: unknown): { section: IgSection } | { problems: string[] } {
  if (section === null || typeof section !== "object" || Array.isArray(section)) {
    return { problems: ["contentTypes.ig is not an object"] };
  }
  const include = (section as { include?: unknown }).include;
  if (!Array.isArray(include)) return { problems: ["contentTypes.ig.include is missing: the section must declare what the harness reads"] };
  if (include.length === 0) return { problems: ["contentTypes.ig.include is empty: it declares nothing to read"] };
  const problems: string[] = [];
  include.forEach((e, i) => {
    const p = includeEntryProblem(e);
    if (p) problems.push(`contentTypes.ig.include[${i}] ${JSON.stringify(e)}: ${p}`);
  });
  const trusted = (section as { trustedScripts?: unknown }).trustedScripts;
  if (trusted !== undefined) {
    if (!Array.isArray(trusted)) problems.push("contentTypes.ig.trustedScripts is not a list");
    else
      trusted.forEach((e, i) => {
        const p = trustedScriptProblem(e);
        if (p) problems.push(`contentTypes.ig.trustedScripts[${i}] ${JSON.stringify(e)}: ${p}`);
      });
  }
  const objects = (section as { trustedSvgs?: unknown }).trustedSvgs;
  if (objects !== undefined) {
    if (!Array.isArray(objects)) problems.push("contentTypes.ig.trustedSvgs is not a list");
    else
      objects.forEach((e, i) => {
        const p = trustedSvgProblem(e);
        if (p) problems.push(`contentTypes.ig.trustedSvgs[${i}] ${JSON.stringify(e)}: ${p}`);
      });
  }
  if (problems.length > 0) return { problems };
  return {
    section: {
      include: include as string[],
      ...(Array.isArray(trusted) && trusted.length ? { trustedScripts: trusted as string[] } : {}),
      ...(Array.isArray(objects) && objects.length ? { trustedSvgs: objects as string[] } : {}),
    },
  };
}

/**
 * Read a repository's `contentTypes.ig`.
 *
 * `undefined` means the repository declares no IG. That is not-a-member, not
 * an error. A section that is present and unusable returns `{ problems }`.
 */
export function readIgSection(repoRoot: string): { section: IgSection } | { problems: string[] } | undefined {
  const p = join(repoRoot, INDEX_SECTION_FILE);
  if (!existsSync(p)) return undefined;
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(p, "utf-8"));
  } catch (e) {
    return { problems: [`${INDEX_SECTION_FILE} does not parse: ${(e as Error).message}`] };
  }
  const types = (doc as { contentTypes?: unknown } | null)?.contentTypes;
  if (types === null || typeof types !== "object") return undefined;
  const section = (types as Record<string, unknown>)[IG_INDEX_SECTION];
  return section === undefined ? undefined : parseIgSection(section);
}

/** Whether `path` (repository-relative, POSIX) is covered by `include`. */
export function igDeclares(section: IgSection, path: string): boolean {
  const rel = path.replace(/^\.\//, "");
  return section.include.some((e) => (e.endsWith("/") ? rel === e.slice(0, -1) || rel.startsWith(e) : rel === e));
}

/** Refuse a path the section does not declare. */
export function assertIgDeclares(section: IgSection, path: string): void {
  if (!igDeclares(section, path)) {
    throw new Error(
      `${path} is not declared in contentTypes.ig.include, so the harness does not read it. ` +
        `Add it to the list if the harness should pay attention to it.`,
    );
  }
}

/** Register `ig`. Calling it twice is harmless: the registry tolerates an identical redefinition. */
export function registerIgContentType(registry: ContentTypeRegistry = defaultContentTypes): void {
  registry.register(IG_INDEX_SECTION, {
    filename: { indexSection: IG_INDEX_SECTION },
    type: IG_TYPE,
    summary: "A FHIR implementation guide's source, with the paths the harness reads declared in `include`.",
    // No facts. The canonical and version are SUSHI's, in `sushi-config.yaml`,
    // and this section does not repeat them, so there is nothing to compare.
  });
}

registerIgContentType();
