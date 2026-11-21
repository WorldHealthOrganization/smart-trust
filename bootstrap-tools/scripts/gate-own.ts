/**
 * Whether a file is the caller's own in a layer's PR checks: the reader of
 * the environment contract the layer PR-check runner sets, restated here in a
 * dozen lines rather than imported, because bootstrap-tools depends on
 * bootstrap and nothing above it (the reason `git-files.ts` gives for its own
 * restatement).
 *
 * @module bootstrap-tools/scripts/gate-own
 *
 * Owner ruling, 2026-11-05 ("Move the checks"): a check of a layer's own
 * committed files runs only in the repository that commits those files, so
 * other layers stop seeing false new failures. `iri:sync:check` read every
 * file in the checkout, the mounted layers' included, so a stale IRI in a
 * mounted layer's docs failed the gate in every root that mounted it.
 *
 * `CAT_GATE_OWN_PATHS` names the caller's own layer directories, relative
 * to the root (`.` for a layer at the root); `CAT_GATE_FOREIGN_PATHS`
 * every other layer's. Unset (a local run, this layer's own CI), every
 * file is judged, as before. The rule is the runner's own reader's, and
 * `gate-own.test.ts` holds this copy to the same cases.
 */

/** The caller's own layers' directories, comma-separated. */
export const GATE_OWN_PATHS_ENV = "CAT_GATE_OWN_PATHS";
/** Every other layer's directory in the root, the same way. */
export const GATE_FOREIGN_PATHS_ENV = "CAT_GATE_FOREIGN_PATHS";

/**
 * Whether the file at `rel` (relative to the root) is the caller's own, or
 * `undefined` when the run names no own paths (judge everything). A file
 * belongs to the deepest layer directory that contains it; a file outside
 * every layer directory is the caller's only when one of its layers
 * sits at the root.
 */
// input-site: env CAT_GATE_OWN_PATHS,CAT_GATE_FOREIGN_PATHS #6166bceb — the instance directories ownership is decided by; the values are the whole of what they contribute
export function gateOwnsFile(rel: string, env: Readonly<Record<string, string | undefined>> = process.env): boolean | undefined {
  const list = (name: string) => (env[name] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const own = list(GATE_OWN_PATHS_ENV);
  if (own.length === 0) return undefined;
  const norm = (p: string) => p.replace(/^\.\/+/, "").replace(/\/+$/, "");
  const file = norm(rel);
  let best: { path: string; own: boolean } | undefined;
  for (const [paths, isOwn] of [[own, true], [list(GATE_FOREIGN_PATHS_ENV), false]] as const) {
    for (const p of paths.map(norm)) {
      if (p === "" || p === ".") continue;
      if ((file === p || file.startsWith(`${p}/`)) && (best === undefined || p.length > best.path.length)) best = { path: p, own: isOwn };
    }
  }
  return best ? best.own : own.map(norm).some((p) => p === "" || p === ".");
}
