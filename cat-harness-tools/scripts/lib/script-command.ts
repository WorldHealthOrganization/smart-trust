/**
 * How a checkout script runs, by NAME: `bun run <name>` where the checkout's
 * own package.json defines it, else through `run-script.ts`, which finds the
 * name among the mounted layers' checkout scripts. Shared by the site build's
 * steps and by every declared writer it runs (`build-instance-site.ts`,
 * `visualiser-writers.ts`), so the fallback is written once.
 *
 * @module scripts/lib/script-command
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { scriptTable } from "../../schemas/sdlc/script-table.ts";

/** `run-script.ts`, beside the scripts that call it. */
export const RUN_SCRIPT = resolve(import.meta.dir, "..", "run-script.ts");

/**
 * Whether the checkout's own package.json defines the script. An IG repository
 * may carry a package.json for its own tooling (one measured holds only
 * fsh-sushi) that names none of the site's steps: `bun run <step>` there
 * fails "Script not found", so the step goes through the mounted layers'
 * script table instead, as it does where there is no package.json at all.
 */
export function ownsScript(root: string, name: string): boolean {
  const file = join(root, "package.json");
  if (!existsSync(file)) return false;
  try {
    const scripts = (JSON.parse(readFileSync(file, "utf-8")) as { scripts?: Record<string, unknown> }).scripts;
    return typeof scripts?.[name] === "string";
  } catch {
    return false;
  }
}

/**
 * How a `bun run cat <writer>` runs: `bun run cat <writer>` where the
 * checkout's own package.json has the `cat` runner, else `run-script.ts`.
 * dth-hrh had no root `cat` script, so `bun run cat avatars:css` ran
 * /usr/bin/cat and refused the build (owner's repin window, 2026-10-15);
 * `init-folio` writes none either.
 */
export function writerCommand(root: string, writer: string): string[] {
  return ownsScript(root, "cat") ? ["bun", "run", "cat", writer] : ["bun", "run", RUN_SCRIPT, writer];
}

/**
 * The command a declaration names, with a script KEY expanded: `bun run cat
 * <key> [args…]` becomes the command the checkout's script table declares for
 * `<key>`, with the arguments after it; any other command comes back as it is.
 * Undefined when the key is declared in no manifest.
 *
 * Owner, 2026-10-15 ("J2"): a Tool definition in the harness names the KEY,
 * and the layer that implements the Tool declares which command implements it
 * (its `checkoutScripts`), so the definition never names the layer above it.
 * `bun run cat` resolves the key when the command runs (`run-script.ts`); this
 * is the same lookup for a reader that needs the command itself — a check that
 * its path exists, or the `-f <Dockerfile>` of a build line.
 */
export function resolveScriptCommand(repoRoot: string, command: string): { key?: string; command: string } | undefined {
  const m = /^\s*bun run cat ([A-Za-z0-9:_.-]+)(\s.*)?$/.exec(command);
  if (m === null || /\.(?:m?[jt]s)$/.test(m[1]!)) return { command };
  const entry = scriptTable(repoRoot).get(m[1]!);
  if (entry === undefined) return undefined;
  return { key: m[1]!, command: `${entry.command}${m[2] ?? ""}` };
}
