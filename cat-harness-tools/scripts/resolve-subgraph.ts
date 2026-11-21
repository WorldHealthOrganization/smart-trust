#!/usr/bin/env bun
/**
 * resolve-subgraph — where a declared subgraph gets its content, as the ONE
 * resolver answers it.
 *
 *   bun run cat subgraph:resolve <dir-id> [--from <instance-root>] [--json]
 *   bun run cat subgraph:resolve --all [--json]
 *
 * Prints the declaring layer, the entry's path, the resolved source
 * (`directory`, `branch` with its keying, or a branch `family` with its
 * prefix, key and repository) and `declaredIn` — which layer answered: the
 * declaration, a legacy `storage`, the layer config's override, or the
 * `directory` default. `branch-store mount`/`push` dispatch on the same
 * answer; this is the way to see it from a shell.
 *
 * Exit: 0 resolved; 1 no layer declares the id; 2 the declaration
 * contradicts itself (both `source` and `storage`, a tip-keyed `qa`), or a
 * declaration cannot be resolved. The declaration is the authority for a
 * branch source.
 *
 * @module scripts/resolve-subgraph
 */
import { resolve } from "node:path";

import { checkoutDirectories, declaredSubgraph, type DeclaredSubgraph } from "../schemas/kg/harness-config.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function line(d: DeclaredSubgraph): string {
  const s = d.source;
  const where =
    s.kind === "branch"
      ? `branch ${s.branch} (keyed by ${s.keyedBy}) mounted at ${s.path}`
      : s.kind === "family"
        ? `branch family ${s.branchPrefix}<${s.keyFrom}>${s.repository ? ` on ${s.repository}` : ""} mounted at ${s.path}`
        : `directory ${s.path}`;
  return `${d.id}: ${where} — declared by ${d.instanceName}, source from ${s.declaredIn}`;
}

if (import.meta.main) {
  const from = resolve(arg("--from") ?? HARNESS_ROOT);
  const json = process.argv.includes("--json");
  const ids = process.argv.includes("--all")
    ? [...new Set(checkoutDirectories(from).filter((d) => d.own && d.within === undefined).map((d) => d.id))]
    : process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--from");
  if (ids.length === 0) {
    console.error("usage: subgraph:resolve <dir-id> [--from <instance-root>] [--json] | --all");
    process.exit(2);
  }
  let code = 0;
  const out: unknown[] = [];
  for (const id of ids) {
    let d: DeclaredSubgraph | undefined;
    try {
      d = declaredSubgraph(from, id);
    } catch (e) {
      console.error(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      code = Math.max(code, 2);
      continue;
    }
    if (d === undefined) {
      console.error(`${id}: no instance in this checkout declares it`);
      code = Math.max(code, 1);
      continue;
    }
    if (json) out.push({ id: d.id, instance: d.instanceName, instanceRoot: d.instanceRoot, source: d.source });
    else console.log(line(d));
  }
  if (json) console.log(JSON.stringify(out, null, 2));
  process.exit(code);
}
