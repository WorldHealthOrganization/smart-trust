/**
 * ig-trusted-scripts.ts — what a `contentTypes.ig.trustedScripts` entry may
 * be. A module of its own, with no imports, so the injection gate
 * (`scripts/ig-content-qa.ts`) can use it without a mounted layer.
 *
 * @module fhir-harness/schemas/ig-trusted-scripts
 * Also what a `contentTypes.ig.trustedSvgs` entry may be: a same-site SVG
 * drawing a page embeds with `<object>`, so its links stay live.
 *
 * @graphNode none — a helper of the ig content type (ig-content-type.ts), kept import-free for the injection gate
 */

/**
 * Why `entry` cannot be a `trustedScripts` path, or `undefined` when it can.
 *
 * A relative, same-site path to a `.js` or `.mjs` file: no scheme, no host,
 * no leading `/`, no `.` or `..` segment, no query or fragment. Anything else
 * could load code from somewhere the IG's own review did not read.
 */
export function trustedScriptProblem(entry: unknown): string | undefined {
  if (typeof entry !== "string" || entry.length === 0) return "not a non-empty string";
  if (!/^[A-Za-z0-9_][A-Za-z0-9._\/-]*\.m?js$/.test(entry)) return "not a relative path to a .js or .mjs file (letters, digits, `._/-` only)";
  if (entry.split("/").some((s) => s === "" || s === "." || s === "..")) return "has an empty, `.` or `..` segment";
  return undefined;
}

/**
 * Why `entry` cannot be a `trustedSvgs` path, or `undefined` when it can.
 *
 * The same rule as a script's, for a `.svg` file: a relative, same-site path,
 * no scheme, host, leading `/`, `.` or `..` segment, query or fragment.
 */
export function trustedSvgProblem(entry: unknown): string | undefined {
  if (typeof entry !== "string" || entry.length === 0) return "not a non-empty string";
  if (!/^[A-Za-z0-9_][A-Za-z0-9._\/-]*\.svg$/.test(entry)) return "not a relative path to a .svg file (letters, digits, `._/-` only)";
  if (entry.split("/").some((s) => s === "" || s === "." || s === "..")) return "has an empty, `.` or `..` segment";
  return undefined;
}
