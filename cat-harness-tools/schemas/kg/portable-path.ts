/**
 * Path segments a checkout can actually create — on every filesystem, not only
 * the one that wrote them.
 *
 * A repository is portable only if every path in its tree can be CREATED on
 * the filesystems people clone it onto. NTFS reserves `:` inside a path
 * component, so one file named `req:<slug>` makes Git abort the whole
 * checkout on Windows — while the author's machine and Linux CI see nothing
 * wrong.
 *
 * ## ENCODE rather than substitute
 *
 * {@link kgQaSidecarPath} promises collision-freedom, and substitution (`:`
 * → `-`) breaks it: `req:agent-workflow` and `req-agent-workflow` would share
 * a sidecar. Percent-encoding is reversible (`%` is itself encoded), so
 * `req:agent-workflow` becomes `req%3Aagent-workflow` — legible, and
 * decodable back to the id.
 *
 * ## The encoder is not the gate, and the gate does not cover everything
 *
 * A hand-authored file bypasses the encoder, so {@link unportableSegment} is
 * also the predicate a repository-wide gate runs
 * (`scripts/check-portable-paths.ts`), failing a clone-breaking name when it
 * is committed.
 *
 * **That gate reads `git ls-files`, so it sees TRACKED paths only.** Output a
 * generator writes into an ignored build directory is outside it; the cover
 * for those writers is encoding at the composer, which is why id-to-filename
 * call sites route through {@link portableSegment}.
 *
 * ## Encoding is not always the right tool
 *
 * Where a segment is also a PUBLIC ROUTE — `scripts/state-visualizer.ts`
 * builds a site directory from a declared graph id — encoding would silently
 * publish `/req%3Ax/`. There the id is refused with a message naming the
 * remedy, as a reserved device name is (`aux` has nothing to encode).
 *
 * @graphNode none — a predicate and an encoder over path strings, not a schema
 * @module schemas/portable-path
 */

/**
 * Characters no Windows path component may contain.
 *
 * `/` is the separator everywhere and `\` is one on Windows, so both are
 * rejected in a SEGMENT even though they are legal bytes in a POSIX filename —
 * a segment carrying either is not one segment.
 */
const RESERVED_CHARS = /[<>:"/\\|?*\u0000-\u001f]/;

/**
 * Windows device names, reserved as the part before the FIRST dot.
 *
 * `CON.txt` is as reserved as `CON`, which is why this is tested against the
 * leading component of the segment rather than against the whole of it.
 */
const RESERVED_NAMES =
  /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/i;

/** Why a segment cannot be created, in words a committer can act on. */
export type UnportableReason =
  | "empty"
  | "reserved-character"
  | "reserved-device-name"
  | "trailing-dot-or-space";

/**
 * Why this segment would break a checkout, or `undefined` if it would not.
 *
 * Returns the REASON rather than a boolean because the two failures want
 * different repairs: a reserved character is renamed or encoded, a reserved
 * device name has to be renamed outright — there is no encoding of `aux` that
 * is still `aux`.
 *
 * @param segment one path component — never a whole path.
 */
export function unportableSegment(segment: string): UnportableReason | undefined {
  if (segment.length === 0) return "empty";
  if (RESERVED_CHARS.test(segment)) return "reserved-character";
  // Windows silently STRIPS a trailing dot or space, so `foo.` and `foo` are
  // one file there and two here. A checkout that renames a file underneath you
  // is worse than one that refuses it.
  if (/[. ]$/.test(segment)) return "trailing-dot-or-space";
  const stem = segment.split(".")[0] ?? "";
  if (RESERVED_NAMES.test(stem)) return "reserved-device-name";
  return undefined;
}

/**
 * The first unportable segment of a path, with the reason, or `undefined`.
 *
 * Takes a repo-relative path with `/` separators — what `git ls-files` prints.
 */
export function unportablePath(
  path: string,
): { segment: string; reason: UnportableReason } | undefined {
  for (const segment of path.split("/")) {
    if (segment === "") continue; // A trailing or doubled separator is not a segment.
    const reason = unportableSegment(segment);
    if (reason) return { segment, reason };
  }
  return undefined;
}

/**
 * A segment that every filesystem can create, reversibly derived from `raw`.
 *
 * Percent-encodes `%` first and then each reserved character, so the mapping is
 * injective — see the module comment for why substitution is not an option
 * here. A trailing dot or space is encoded for the same reason it is rejected
 * above: Windows would strip it and quietly alias two names into one.
 *
 * It does NOT rescue a reserved device name, because encoding cannot: `aux`
 * contains nothing to encode. {@link unportableSegment} still reports one, and
 * a subject whose id is `aux` needs a different id.
 */
export function portableSegment(raw: string): string {
  const encoded = raw
    .replace(/%/g, "%25")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
  return encoded.replace(/[. ]$/, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
}
