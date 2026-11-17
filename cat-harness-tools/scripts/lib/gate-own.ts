/**
 * Which layers' files a gate run is the judge of: the caller's OWN
 * layers, as the layer PR-check runner names them.
 *
 * @module scripts/lib/gate-own
 * @graphNode none — an environment contract and its reader
 *
 * Owner ruling, 2026-11-05 ("Move the checks"): a check of a layer's own
 * committed files runs only in the repository that commits those files, so
 * other layers stop seeing false new failures. `check:schema-nodes` walks
 * every declared `schemas/` directory in the checkout, the mounted lower
 * layers' included, so a defect committed to cat-harness-tools main
 * (cat-harness-tools#1478) failed the gate in every root that mounts it, and
 * smart-ra#228's re-pin listed it as a newly failing gate.
 *
 * `run-gates.py` (`.github/scripts/layer-pr-checks/`) sets
 * {@link GATE_OWN_ENV} to the caller's own layers, comma-separated. A
 * check that honours it judges only the directories those layers
 * declare; the mounted layers' files are judged by their own CI. Unset (a
 * local run, the index's own gates workflow), the check judges the whole
 * checkout, as before.
 */
import { checkoutDirectories, corpusDirectoriesForGraph } from "../../schemas/kg/harness-config.js";

/** Comma-separated names of the layers whose files this run judges. */
export const GATE_OWN_ENV = "CAT_GATE_OWN_INSTANCES";

/** The caller's own layers, or `undefined` when the run names none (judge everything). */
// input-site: env CAT_GATE_OWN_INSTANCES #e41b5e4a — the layers whose files are judged; the value is the whole of what it contributes
export function gateOwnInstances(env: Readonly<Record<string, string | undefined>> = process.env): Set<string> | undefined {
  const raw = env[GATE_OWN_ENV];
  const names = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return names.length > 0 ? new Set(names) : undefined;
}

/** The corpus directories holding `kind` that `own`'s layers commit (an inherited member counts as its member's). */
export function ownDirectoriesForGraph(root: string, kind: string, own: ReadonlySet<string>): string[] {
  return checkoutDirectories(root, { stackedOn: root })
    .filter((d) => d.graphTypologies.includes(kind as never) && own.has(d.member ?? d.declaredBy))
    .map((d) => d.absPath);
}

/**
 * The directories holding `kind` whose files a gate JUDGES: the corpus
 * (`corpusDirectoriesForGraph`), or, when this run names its own layers,
 * only the ones they commit. `scoped` says which, so a check can tell "this
 * caller commits none" (nothing of its own to judge, a pass) from "the corpus
 * has none" (its own refusal, unchanged).
 *
 * For the SUBJECTS of a check only. A reference resolved against the corpus
 * (a citation into a lower layer's library, a link into its skills) keeps the
 * whole corpus: a caller may rely on what it mounts.
 */
export function gateDirectoriesForGraph(
  root: string,
  kind: string,
  // input-site: env CAT_GATE_OWN_INSTANCES #949cc29c — passed to gateOwnInstances; the value is the whole of what it contributes
  env: Readonly<Record<string, string | undefined>> = process.env,
): { dirs: string[]; scoped: ReadonlySet<string> | undefined } {
  const own = gateOwnInstances(env);
  if (!own) return { dirs: corpusDirectoriesForGraph(root, kind), scoped: undefined };
  return { dirs: ownDirectoriesForGraph(root, kind, own), scoped: own };
}

/** The line a scoped check prints when its caller commits nothing it judges. */
export function nothingOwnLine(check: string, what: string, own: ReadonlySet<string>): string {
  return `✓ ${check}: ${[...own].join(", ")} commits no ${what}; the mounted layers' are judged by their own CI.`;
}

/** The caller's own layers' directories, relative to the root (`.` for a layer at the root), comma-separated. */
export const GATE_OWN_PATHS_ENV = "CAT_GATE_OWN_PATHS";
/** Every other layer's directory in the root, the same way. */
export const GATE_FOREIGN_PATHS_ENV = "CAT_GATE_FOREIGN_PATHS";

/**
 * Whether the file at `rel` (relative to the root) is the caller's own, or
 * `undefined` when this run names no own paths (judge everything). For a
 * check whose subjects are FILES rather than declared directories: a file
 * belongs to the deepest layer directory that contains it, and a file
 * outside every layer directory (the index's own README) is the caller's
 * only when one of its layers sits at the root.
 */
// input-site: env CAT_GATE_OWN_PATHS,CAT_GATE_FOREIGN_PATHS #6166bceb — the layer directories ownership is decided by; the values are the whole of what they contribute
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
