#!/usr/bin/env bun
/**
 * Render stage 3 (`kg-dynamic`): publish the running workflows' state as
 * JSON-LD at `<site>/<harness>/state.jsonld`. The workflow pages read this
 * file when they load.
 *
 * It is a different document from the stage-1 graph export: a different
 * name, `type: cat-harness:DynamicState` and `$schema:
 * cat-harness-dynamic-state/v1`, holding only instances, positions and stuck
 * states. Built by the same readers the workflow pages use
 * (`dynamicStateInputs`), so the two never disagree about which layers
 * exist.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/dynamic-state-export.ts [--site <dir>] [--out <file>]
 *
 * A store that could not be read (a checkout without its bean branch) is
 * named in `unreadStores`, so its layers read as unknown, never as none.
 */
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { writeDynamicState } from "./state-visualizer.ts";

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: "string" }, site: { type: "string" } }, strict: false });
  const { doc, unread, out } = await writeDynamicState(typeof values.out === "string" ? resolve(values.out) : undefined);
  const stuck = doc.graph.filter((n) => n.stuck.length > 0).length;
  console.log(
    `dynamic-state-export: ${doc.graph.length} instance(s), ${stuck} stuck` +
      (unread.length > 0 ? `; could not read ${unread.join(", ")} (named in unreadStores)` : "") +
      ` → ${out}`,
  );
}

if (import.meta.main) await main();
