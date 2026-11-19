#!/usr/bin/env bun
/**
 * `bun run cat <name> [args…]` — run a checkout script wherever it is declared.
 *
 * Scripts are declared in the layer each one runs (`schemas/sdlc/script-table.ts`).
 * `bun run` reads only the manifest in the directory it starts in, so the root
 * keeps this one entry, `cat`, and this finds the script by asking the declared
 * layers.
 *
 * A `.ts`/`.js` path in place of a name runs that file, as `bun run <file>`
 * does, so a caller whose list mixes names and files needs no second spelling.
 *
 * It runs the command exactly as `bun run` does: through `sh -c` from the
 * CHECKOUT ROOT, with `node_modules/.bin` first on PATH, the arguments
 * appended, and `npm_lifecycle_event` set to the script's name. The exit code
 * is the command's.
 *
 * @covers none — a command runner, not a graph audit
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { layerRootsIn } from "../schemas/kg/instance-roots.ts";
import { scriptTable } from "../schemas/sdlc/script-table.ts";

function repoRoot(): string {
  const toolsRoot = resolve(import.meta.dir, "..");
  const parentRoot = resolve(import.meta.dir, "..", "..");
  if (
    existsSync(join(parentRoot, "cat-harness", "cat-harness.json")) ||
    existsSync(join(parentRoot, "index.config.json")) ||
    existsSync(join(parentRoot, "package.json"))
  ) {
    return parentRoot;
  }
  if (existsSync(join(toolsRoot, "package.json"))) {
    return toolsRoot;
  }
  return parentRoot;
}

/** POSIX single-quote an argument for `sh -c`. */
export function shellQuote(arg: string): string {
  return /^[A-Za-z0-9_\-./:=@%+,]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}

export interface LayerScriptEntry {
  name: string;
  /** The command, relative to `cwd` (the declaring layer's directory). */
  command: string;
  /** Absolute path of the declaring layer's directory. */
  cwd: string;
  /** Repository-relative path to the declaring manifest. */
  manifest: string;
}

/**
 * Look up a script declared under `scripts` (layer-relative) of a mounted
 * layer when it is not in the checkout-root `scriptTable`. Throws if two
 * mounted layers declare the same `scripts[name]`.
 */
export function layerScript(repoRoot: string, name: string): LayerScriptEntry | undefined {
  const root = resolve(repoRoot);
  let found: LayerScriptEntry | undefined;
  for (const inst of layerRootsIn(root)) {
    const absInst = resolve(inst);
    if (absInst === root) continue;
    const pkgPath = join(absInst, "package.json");
    if (!existsSync(pkgPath)) continue;
    let scripts: unknown;
    try {
      scripts = (JSON.parse(readFileSync(pkgPath, "utf-8")) as { scripts?: unknown }).scripts;
    } catch {
      continue;
    }
    if (scripts === null || typeof scripts !== "object") continue;
    const cmd = (scripts as Record<string, unknown>)[name];
    if (typeof cmd !== "string") continue;
    const manifest = join(relative(root, absInst), "package.json");
    if (found) {
      throw new Error(`script "${name}" is declared in scripts of both ${found.manifest} and ${manifest}`);
    }
    found = { name, command: cmd, cwd: absInst, manifest };
  }
  return found;
}

if (import.meta.main) {
  const [name, ...args] = process.argv.slice(2);
  const cwd = process.cwd();
  let REPO = repoRoot();
  if (name !== undefined && name !== "--list") {
    try {
      if (scriptTable(cwd).has(name)) REPO = cwd;
    } catch {
      // Fall back to REPO.
    }
  }
  const table = scriptTable(REPO);
  if (name === undefined || name === "--list") {
    for (const e of [...table.values()].sort((a, b) => a.name.localeCompare(b.name))) console.log(`${e.name}\t${e.manifest}`);
    process.exit(name === undefined ? 2 : 0);
  }
  const entry = table.get(name);
  // Not in the checkout-root table: a mounted layer may declare it under its
  // own `scripts` (layer-relative), as cat-harness does for folio:render:check.
  const layer = entry ? undefined : layerScript(REPO, name);
  // A FILE, not a script name: callers that pass either (qa-refresh's writer
  // list, skill-register's steps) hand it here, and it runs as `bun run <file>`
  // would have, from the checkout root.
  if (!entry && !layer && /\.(?:m?[jt]s)$/.test(name)) {
    const r = spawnSync(process.execPath, ["run", name, ...args], { cwd: REPO, stdio: "inherit", env: process.env });
    process.exit(r.status ?? (r.signal ? 1 : 0));
  }
  if (!entry && !layer) {
    const near = [...table.keys()].filter((k) => k.includes(name) || name.includes(k)).slice(0, 8);
    console.error(`bun run cat: no script "${name}" in any declared manifest.${near.length ? ` Did you mean: ${near.join(", ")}?` : ""}`);
    process.exit(2);
  }
  if (layer) {
    const command = [layer.command, ...args.map(shellQuote)].join(" ");
    const r = spawnSync("sh", ["-c", command], {
      cwd: layer.cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: `${join(layer.cwd, "node_modules", ".bin")}:${join(REPO, "node_modules", ".bin")}:${process.env.PATH ?? ""}`,
        npm_lifecycle_event: name,
      },
    });
    process.exit(r.status ?? (r.signal ? 1 : 0));
  }
  let baseCommand = entry!.command;
  const prefixMatch = /^bun run ([A-Za-z0-9._-]+)\/(.+)$/.exec(baseCommand);
  if (prefixMatch) {
    const [, layerDir, rest] = prefixMatch;
    if (!existsSync(join(REPO, layerDir!)) && existsSync(join(REPO, rest!.split(/\s+/)[0]!))) {
      baseCommand = `bun run ${rest}`;
    }
  }
  const command = [baseCommand, ...args.map(shellQuote)].join(" ");
  const r = spawnSync("sh", ["-c", command], {
    cwd: REPO,
    stdio: "inherit",
    env: {
      ...process.env,
      PATH: `${join(REPO, "node_modules", ".bin")}:${process.env.PATH ?? ""}`,
      npm_lifecycle_event: name,
    },
  });
  process.exit(r.status ?? (r.signal ? 1 : 0));
}
