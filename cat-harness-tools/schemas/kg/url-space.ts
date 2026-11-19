/**
 * Where a published thing is served: one resolver for the site's URL space.
 *
 * | case | path | what it is |
 * |---|---|---|
 * | `root` | `<base>/<path>` | the root's rendering — its `docs/` is installed by cat-harness, so it has no segment |
 * | `instance` | `<base>/<instance>/<path>` | the layer presented as itself, on its own theme |
 * | `viewer` | `<base>/<locale>/<owner>/<graph>/<subject>/<path>` | a viewer of one layer's assets, rendered by another layer's machinery; `<locale>/` only when one is given |
 *
 * - The host is no exception: its graph document, Tools and subjects are the
 *   `instance` case, `<base>/cat-harness/…`, like every layer's. `root` is the
 *   index's own docs rendering, never a layer's graph.
 * - The segment is the layer's `name`, never its `stub`: the stub names
 *   published FILES (`<stub>.jsonld`), the name names the layer.
 * - The declared graph is a segment, because a layer may declare more
 *   than one renderable graph and two would otherwise collide on one URL.
 * - A locale is a segment of VIEWER pages only, placed first as for every
 *   visualiser page (`/<locale>/<declaring>/<kind>/…`). The root and a
 *   layer as itself carry none, so a layer's `.jsonld` identifier does
 *   not change with a reader's language. With a locale the viewer case is
 *   exactly `visualiserRoute`'s route, which its test asserts.
 *
 * Paths here are site-relative and start with `/` unless `base` is given;
 * a directory path ends with `/` exactly when the caller's `path` does (or is
 * empty), so a page and a directory are never conflated.
 *
 * Nothing here reads the disk: a consumer passes names it has already
 * resolved, so the same answer comes back in a test, a generator and a
 * workflow.
 *
 * @graphNode schema
 * @module schemas/url-space
 */

/** One published location, by case. */
export type PublishedLocation =
  | { case: "root"; path?: string }
  | { case: "instance"; instance: string; path?: string }
  | { case: "viewer"; owner: string; graph: string; subject?: string; path?: string; locale?: string };

/** A segment as given, with no slash at either end; refuses an empty or a traversing one. */
function segment(label: string, s: string): string {
  const t = s.replace(/^\/+|\/+$/g, "");
  if (t === "" || t.split("/").some((p) => p === "" || p === "." || p === "..")) {
    throw new Error(`url-space: ${label} ${JSON.stringify(s)} is not a path segment`);
  }
  return t;
}

/** The tail: no leading slash, a trailing one kept, and no `.`/`..` steps. */
function tail(path: string | undefined): string {
  const p = (path ?? "").replace(/^\/+/, "");
  if (p.split("/").some((s) => s === "." || s === "..")) {
    throw new Error(`url-space: path ${JSON.stringify(path)} steps outside its location`);
  }
  return p;
}

/**
 * The published path of `loc`, under `base` (`""` for site-relative).
 *
 * `base` is the site's own prefix — `https://litlfred.github.io/folio-assistant`
 * or `/folio-assistant` — with or without a trailing slash.
 */
export function publishedPath(loc: PublishedLocation, base = ""): string {
  const prefix = base.replace(/\/+$/, "");
  const dirs: string[] = [];
  switch (loc.case) {
    case "root":
      break;
    case "instance":
      dirs.push(segment("instance", loc.instance));
      break;
    case "viewer":
      if (loc.locale !== undefined) dirs.push(segment("locale", loc.locale));
      dirs.push(segment("owner", loc.owner), segment("graph", loc.graph));
      if (loc.subject !== undefined) dirs.push(segment("subject", loc.subject));
      break;
  }
  const head = dirs.length > 0 ? `${dirs.join("/")}/` : "";
  return `${prefix}/${head}${tail(loc.path)}`;
}

/**
 * Whether a layer is published: its declared `enabled`, which defaults to
 * enabled. Not publishing is a DECLARATION (`"enabled": false`), never an
 * absence, so a layer missing from the site is always explained by its
 * own file.
 */
export function isPublished(d: { enabled?: boolean }): boolean {
  return d.enabled !== false;
}
