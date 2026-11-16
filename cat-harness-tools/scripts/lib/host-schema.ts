/**
 * Where the HOST's schema documents are published: under `<site>/<name>/`,
 * beside its graph document, not at the site root.
 *
 * @module scripts/lib/host-schema
 *
 * litlfred/cat-harness-tools#603 decision 1b(i), "move all" (owner,
 * 2026-10-23): the host is no longer special. #620 moved its document, Tools
 * and subjects under `<site>/<name>/`; this follow-up (#676) moves the schema
 * documents it publishes the same way, keeping each one's path below that
 * directory:
 *
 * | before (#620 and earlier) | now |
 * |---|---|
 * | `<site>/<stub>.schema.json` | `<site>/<name>/<stub>.schema.json` |
 * | `<site>/tool.schema.json` | `<site>/<name>/tool.schema.json` |
 * | `<site>/tool-types.schema.json`, `tool-types/<Name>.schema.json` | `<site>/<name>/tool-types…` |
 * | `<site>/skills/<skill>/<io>.schema.json` | `<site>/<name>/skills/<skill>/<io>.schema.json` |
 *
 * The segment is the host's declared NAME, through cat-harness's one
 * URL-space resolver (`publishedPath`, `case: "instance"`), the same one
 * `kg-export`'s `exportIdentity` places the document with. So the schemas and
 * the document cannot disagree about the directory.
 *
 * Each old root address keeps a one-release tombstone ({@link movedSchema}),
 * and a source contract still carrying its old root `$id` is accepted for the
 * same release (`staleSkillIoIds`), so this layer and cat-harness's
 * rewritten contracts can be re-pinned in either order. Both go together.
 */
import { readDeclaration, renderingPath } from "../../schemas/kg/cat-harness.js";
import { publishedPath } from "../../schemas/kg/url-space.js";

import { HARNESS_NAME, HARNESS_ROOT } from "./roots.ts";

/** The host's declared name: the directory its schemas sit in. */
export function hostName(root: string = HARNESS_ROOT): string {
  try {
    return readDeclaration(root)?.name ?? HARNESS_NAME;
  } catch {
    return HARNESS_NAME;
  }
}

/**
 * A host schema's site-relative path: `<name>/<rel>`.
 *
 * `rel` is the path the document had at the site root before the move,
 * which is also its path below the host's directory now.
 */
export function hostSchemaPath(rel: string, root: string = HARNESS_ROOT): string {
  return publishedPath({ case: "instance", instance: hostName(root), path: rel }).replace(/^\//, "");
}

/**
 * The site-root path a host schema had before the move, given its path now
 * (`<name>/<rel>` → `<rel>`); `undefined` for a path outside the host's
 * directory. Where its tombstone is written.
 */
export function legacyHostSchemaPath(path: string, root: string = HARNESS_ROOT): string | undefined {
  const prefix = hostSchemaPath("", root);
  return path.startsWith(prefix) && path.length > prefix.length ? path.slice(prefix.length) : undefined;
}

/**
 * The base the host's schema `$id`s are minted under, `<base>/<name>`, or
 * `""` with no base: an `$id` is absolute or absent, never relative.
 *
 * Also the base the shared Tool I/O type IRIs are minted against
 * (`tools/discover.ts`), because the type vocabulary is one of these
 * documents.
 */
export function hostSchemaBase(base: string, root: string = HARNESS_ROOT): string {
  const b = base.replace(/\/+$/, "");
  return b ? renderingPath(b, hostName(root)) : "";
}

/**
 * The tombstone served at a moved schema's old address, for one release.
 *
 * GitHub Pages cannot redirect, so the forwarding is in the file. The
 * document keeps its old `$id`, says `deprecated` (a JSON Schema annotation
 * draft-07 ignores, so it is inert for validation) and `isReplacedBy` the new
 * `$id`, and validates exactly as the new document does through
 * `allOf: [{ $ref }]`. Not a bare `$ref`, because draft-07 ignores every
 * keyword beside one, the `$id` included.
 *
 * `defs` forwards named definitions: a reader holding
 * `<old>#/$defs/<Name>` (a Tool port, before the move) still finds one.
 */
export function movedSchema(
  oldIri: string,
  newIri: string,
  title: unknown,
  defs: Record<string, string> = {},
  stamp: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: oldIri,
    title: typeof title === "string" ? `${title} (moved)` : "Moved schema",
    description:
      `Moved to ${newIri} (litlfred/cat-harness-tools#603 decision 1b: the host's documents sit under its own ` +
      "directory, like every layer's). This address is a tombstone kept for one release; it validates as the new document does.",
    deprecated: true,
    isReplacedBy: newIri,
    allOf: [{ $ref: newIri }],
    ...(Object.keys(defs).length > 0
      ? { $defs: Object.fromEntries(Object.entries(defs).map(([name, to]) => [name, { $ref: to }])) }
      : {}),
    ...stamp,
  };
}
