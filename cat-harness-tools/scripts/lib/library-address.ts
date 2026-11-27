/**
 * How a library page reads WHICH ENTRY it is about from its own address —
 * owner, 2026-10-02 (#1881): *"each asset gets its own IRI"*, *"no query
 * strings"*, and every such IRI a materialized page on gh-pages.
 *
 * An entry's IRI is `<library>/<instance>/<id>/`. The generator writes a thin
 * shell at that path (`gen-library-viz.ts`), and the shared viewer script
 * reads the path back with {@link ADDRESS_JS}. The older `#<instance>/<id>`
 * fragment is LEGACY: honoured once and normalised to the path, never emitted.
 *
 * Kept as JavaScript SOURCE in a string, like `library-withheld-view.ts`,
 * because it runs in the browser inside the published `viewer.js`. Tests
 * evaluate the same string, so what is tested is byte-for-byte what ships —
 * a TypeScript twin would be a second copy free to disagree.
 *
 * @module scripts/lib/library-address
 */

/**
 * `entryFromPath(pathname, libRoot)` — `{ instance, id }` when the path is
 * exactly `<libRoot><instance>/<id>/` (an `index.html` tail allowed), else
 * `null`. It only PARSES: whether that entry exists is the caller's question,
 * asked against the projection, so nothing is ever built from this alone.
 *
 * `legacyKey(hash)` — the `<instance>/<id>` an old `#…` link names, or `""`.
 */
export const ADDRESS_JS = String.raw`
function entryFromPath(pathname, libRoot){
  if (typeof pathname !== "string" || typeof libRoot !== "string" || !libRoot) return null;
  if (pathname.indexOf(libRoot) !== 0) return null;
  var rest = pathname.slice(libRoot.length).replace(/index\.html$/, "").replace(/\/+$/, "");
  var parts = rest.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    return { instance: decodeURIComponent(parts[0]), id: decodeURIComponent(parts[1]) };
  } catch (_e) {
    return null;
  }
}
function legacyKey(hash){
  var raw = String(hash || "").replace(/^#/, "");
  if (!raw) return "";
  var key;
  try { key = decodeURIComponent(raw); } catch (_e) { key = raw; }
  return /^[^/]+\/[^/]+$/.test(key) ? key : "";
}
`;
