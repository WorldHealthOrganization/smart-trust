/**
 * The checkout's script table, read from where each script lives.
 *
 * Each layer carries the scripts whose command runs ITS code, in its own
 * `package.json` under `checkoutScripts`; the root keeps only the few that
 * run no layer's code (the whole-checkout `test` and `typecheck`, and the
 * `bootstrap-tools` submodule's own commands) plus `cat`, the runner.
 *
 * ## Why `checkoutScripts` and not `scripts`
 *
 * Every command here is written relative to the CHECKOUT ROOT, and
 * `bun run cat <name>` runs it there. A layer's `scripts` key, by the
 * convention `bootstrap-tools` already keeps, is run from the LAYER's
 * directory (`cd <layer> && bun run <name>`), where root-relative commands
 * would fail.
 *
 * ## How a script is found
 *
 * By asking the declared layers, never by naming one: this module is the
 * LOWEST layer's, so a literal list here would point up the layer order.
 * {@link layerRootsIn} answers which directories are layers; each one's
 * `package.json` is read for `checkoutScripts`. A name defined twice is an
 * error, not a precedence rule, except within the root's own manifest, where
 * `scripts` wins over the same name in its `checkoutScripts`.
 *
 * @graphNode none — functions that read the script table; no schema
 * @covers none — a reader of the script table, not a graph audit
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { layerRootsIn } from "../kg/instance-roots.ts";

/** The key a layer's `package.json` carries its checkout-root scripts under. */
export const CHECKOUT_SCRIPTS_KEY = "checkoutScripts";

export interface ScriptEntry {
  name: string;
  /** The command, relative to the checkout root. */
  command: string;
  /** The manifest it is declared in, repository-relative (`package.json` for the root). */
  manifest: string;
}

function readJson(path: string): Record<string, unknown> | undefined {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
}

/**
 * Every script the checkout declares, by name.
 *
 * Throws when a name is declared in two manifests: there is no correct
 * answer to pick, so the caller must not be handed one.
 */
export function scriptTable(repoRoot: string): Map<string, ScriptEntry> {
  const root = resolve(repoRoot);
  const out = new Map<string, ScriptEntry>();
  const add = (scripts: unknown, manifest: string): void => {
    if (scripts === null || typeof scripts !== "object") return;
    for (const [name, command] of Object.entries(scripts as Record<string, unknown>)) {
      if (typeof command !== "string") continue;
      const prior = out.get(name);
      if (prior) {
        throw new Error(`script "${name}" is declared twice: in ${prior.manifest} and in ${manifest}`);
      }
      out.set(name, { name, command, manifest });
    }
  };
  const rootPkg = readJson(join(root, "package.json"));
  add(rootPkg?.scripts, "package.json");
  // A root that is itself an instance (an IRIS or IG repository) declares each script twice in
  // ONE manifest: `scripts` with root paths, `checkoutScripts` with the paths a
  // host that mounts it uses. At its own root the `scripts` spelling is the one
  // that runs, so a `checkoutScripts` name it already has is not a second declaration.
  const own = rootPkg?.[CHECKOUT_SCRIPTS_KEY];
  if (own !== null && typeof own === "object") {
    add(Object.fromEntries(Object.entries(own as Record<string, unknown>).filter(([n]) => !out.has(n))), "package.json");
  }
  for (const inst of layerRootsIn(root)) {
    if (resolve(inst) === root) continue;
    const manifest = join(relative(root, inst), "package.json");
    add(readJson(join(root, manifest))?.[CHECKOUT_SCRIPTS_KEY], manifest);
  }
  return out;
}

/** The table as the flat `name → command` record a root `package.json`'s `scripts` used to be. */
export function scriptsOf(repoRoot: string): Record<string, string> {
  return Object.fromEntries([...scriptTable(repoRoot)].map(([n, e]) => [n, e.command]));
}

/** The script name a `bun run <name> …` or `bun run cat <name> …` command invokes, or undefined. */
export function scriptNameOf(command: string): string | undefined {
  const m = /^\s*bun run (?:cat )?([A-Za-z0-9:_.-]+)(?:\s|$)/.exec(command);
  return m?.[1];
}
