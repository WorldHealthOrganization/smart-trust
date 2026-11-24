/**
 * Where a lane's Role has its page, for the actors line under a BPMN drawing
 * (`src/workflow/diagram-actors.ts`, owner 2026-11-23).
 *
 * @module scripts/lib/role-actors
 *
 * A Role's page is its subject IRI, `<doc dir>/role/<id>` (#603), for the
 * `roles.json` of whichever layer declares it — the same link the processes
 * viewer's ⓘ panel gives a role (`panelContext`). Absolute, so a docs page and
 * a skill page at any depth link it alike. A role no layer declares, or whose
 * layer publishes no page, resolves to its title alone or to nothing, and the
 * line lists that lane unlinked.
 */
import { join } from "node:path";

import { layerRootsIn, repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { readRoleGraph } from "../../schemas/process/role-graph.ts";
import type { ActorResolver } from "../../src/workflow/diagram-actors.ts";
import { kgRoots } from "../known-skills.ts";
import { subjectHref } from "./subject-pages.ts";

/** The resolver for every Role declared in the checkout holding `root`; read once, asked per lane. */
export function roleActorResolver(root: string): ActorResolver {
  const at = new Map<string, { title: string; file: string }>();
  for (const layer of layerRootsIn(repoRootFor(root))) {
    let kgs: string[] = [];
    try {
      kgs = kgRoots(layer);
    } catch {
      continue;
    }
    for (const kg of kgs) {
      for (const r of readRoleGraph(kg)?.roles ?? []) {
        if (!at.has(r.id)) at.set(r.id, { title: r.title, file: join(kg, "roles.json") });
      }
    }
  }
  return (ref) => {
    const role = at.get(ref);
    if (role === undefined) return undefined;
    const href = subjectHref(role.file, "role", ref);
    return { ...(href ? { href } : {}), ...(role.title ? { title: role.title } : {}) };
  };
}
