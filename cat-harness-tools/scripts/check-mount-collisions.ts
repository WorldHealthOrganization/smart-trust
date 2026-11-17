#!/usr/bin/env bun
/**
 * Mount path and route collision gate.
 *
 * Checks that:
 * 1. Remote mount paths do not collide with:
 *    - Downstream declared directories
 *    - Reserved root and site route names
 *    - Sibling mounts
 *    When a collision occurs, clearly says how to fix it: "set `path`".
 * 2. Visualiser route aliases do not collide with:
 *    - Another visualiser's alias (names both claimants)
 *    - A harness route (names both claimants)
 *    - A reserved site route (names both claimants)
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/check-mount-collisions.ts
 *   bun run cat-harness-tools/scripts/check-mount-collisions.ts --root <dir>
 *   bun run cat check:mount-collisions
 *
 * @covers cat-harness — it reads the index's declared mounts, each declaration's directories and its visualiser routes
 * @module scripts/check-mount-collisions
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { layerRootsIn, readDeclaration, visualisationsOf } from "../schemas/kg/cat-harness.js";
import { readDeclaredMounts, readIndexConfig } from "../schemas/kg/index-config.js";
import {
  RESERVED_ROOT_AND_ROUTE_NAMES,
  checkMountPathCollisions,
  checkVisualizerRouteCollisions,
  type MountCollisionFinding,
  type RouteCollisionFinding,
  type VisualizerRouteClaim,
} from "../schemas/kg/remote-mount.js";

export {
  RESERVED_ROOT_AND_ROUTE_NAMES,
  checkMountPathCollisions,
  checkVisualizerRouteCollisions,
  type MountCollisionFinding,
  type RouteCollisionFinding,
};

export interface CheckCollisionsResult {
  root: string;
  mountCollisions: MountCollisionFinding[];
  routeCollisions: RouteCollisionFinding[];
}

/**
 * Audit a repository / layer root for mount path and visualiser route collisions.
 */
export function checkAllCollisions(root: string): CheckCollisionsResult {
  const absRoot = resolve(root);

  // 1. Gather declared mounts
  const declared = readDeclaredMounts(absRoot);
  const mounts = declared.mounts.map((m) => ({
    harness: m.harness,
    path: m.overrides?.[m.harness]?.path,
  }));

  // 2. Gather downstream declared directories and local layers
  const decl = readDeclaration(absRoot);
  const declaredDirs: string[] = (decl?.directories ?? []).map((d) => d.path);

  const idx = readIndexConfig(absRoot);
  if (idx.state === "ok") {
    for (const inst of idx.config.instances) {
      if (inst.source && "local" in inst.source) {
        const at = inst.source.local.at;
        if (at !== ".") declaredDirs.push(at);
      }
    }
  }

  // Check mount path collisions
  const mountCollisions = checkMountPathCollisions(mounts, { declaredDirs });

  // 3. Gather visualiser routes from instantiated / local harnesses
  const visualizers: VisualizerRouteClaim[] = [];
  const harnessNames: string[] = [];

  const candidateRoots = layerRootsIn(absRoot);
  if (candidateRoots.length === 0 && existsSync(join(absRoot, "cat-harness.json"))) {
    candidateRoots.push(absRoot);
  }

  for (const hRoot of candidateRoots) {
    try {
      const hDecl = readDeclaration(hRoot);
      if (!hDecl) continue;
      harnessNames.push(hDecl.name);
      for (const d of hDecl.directories ?? []) {
        for (const v of visualisationsOf(d.coverage, d.id)) {
          visualizers.push({
            harness: hDecl.name,
            visualizer: v.title ?? d.id,
            alias: v.alias,
          });
        }
      }
    } catch {
      // unreadable declarations are reported by check:declaration-filename
    }
  }

  // Check route collisions
  const routeCollisions = checkVisualizerRouteCollisions(visualizers, {
    harnessNames,
  });

  return {
    root: absRoot,
    mountCollisions,
    routeCollisions,
  };
}

if (import.meta.main) {
  let root = process.cwd();
  let json = false;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root" && args[i + 1]) {
      root = args[++i]!;
    } else if (args[i] === "--json") {
      json = true;
    }
  }

  let result: CheckCollisionsResult;
  try {
    result = checkAllCollisions(root);
  } catch (err) {
    console.error(`check-mount-collisions: ${(err as Error).message}`);
    process.exit(2);
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.mountCollisions.length || result.routeCollisions.length ? 1 : 0);
  }

  let failed = false;

  if (result.mountCollisions.length) {
    failed = true;
    console.error(`\n${result.mountCollisions.length} mount path collision finding(s):`);
    for (const f of result.mountCollisions) {
      console.error(`  - [${f.kind}] ${f.message}`);
    }
  }

  if (result.routeCollisions.length) {
    failed = true;
    console.error(`\n${result.routeCollisions.length} visualiser route collision finding(s):`);
    for (const f of result.routeCollisions) {
      console.error(`  - [${f.kind}] ${f.message}`);
    }
  }

  if (failed) {
    console.error(`\nMount and route collision check failed. Set \`path\` on colliding mounts or adjust conflicting aliases.`);
    process.exit(1);
  } else {
    console.log(`0 mount collision findings; 0 route collision findings in ${result.root}`);
    process.exit(0);
  }
}
