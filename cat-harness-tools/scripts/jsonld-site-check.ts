#!/usr/bin/env bun
/**
 * Does every layer's knowledge graph render to its published JSON-LD?
 *
 * @module scripts/jsonld-site-check
 * @graphNode none — a gate over the composition, through `kg-export --judge`
 * @covers computed — it renders every layer's whole graph, whichever kinds that layer declares
 *
 * Owner, 2026-11-13: "merge to main fails if json(ld) dont render to
 * gh-pages". The site publishes each layer's graph as `<base>/<stub>.jsonld`
 * (`kg:export`, `renderingPath`). This gate builds every one of them the way the
 * publish does, IN MEMORY (`kg-export --judge --instance <layer>`, which writes
 * nothing), and fails when any does not render: a root field or term outside
 * the `@context`, a keyword/alias collision, or a source that could not be
 * read. Dangling links stay reported, not gated, as in the judge.
 *
 * The committed JSON-LD the export reads (block, library and site siblings,
 * `ns/content/v1.jsonld`) is judged current by `gen:jsonld:check`. Both are
 * ALWAYS GREEN (`compare-gates.py`): red on a PR's head fails the PR even when
 * main is red too.
 *
 * Exit: 0 every layer renders · 1 some layer does not · 2 none failed but some
 * could not be determined (never read as a pass) · 78 no layer here.
 *
 * Usage:
 *   bun run cat jsonld:site:check
 *   bun run cat jsonld:site:check -- --root <checkout>
 */
import { spawnSync } from "node:child_process";
import { relative, resolve } from "node:path";

import { layerRootsIn } from "../schemas/kg/instance-roots.ts";
import { NOT_APPLICABLE_EXIT } from "./lib/not-applicable.ts";

export interface LayerVerdict {
  layer: string;
  exit: number;
  summary: string;
}

/** 0 every layer renders · 1 one does not · 2 none failed, some undetermined · 78 nothing judged. */
export function verdictOf(rows: readonly LayerVerdict[]): 0 | 1 | 2 | 78 {
  if (rows.length === 0) return NOT_APPLICABLE_EXIT as 78;
  if (rows.some((r) => r.exit === 1)) return 1;
  if (rows.some((r) => r.exit !== 0)) return 2;
  return 0;
}

function judge(root: string, instance: string): LayerVerdict {
  const rel = relative(root, instance) || ".";
  const r = spawnSync("bun", ["run", resolve(import.meta.dir, "kg-export.ts"), "--judge", "--instance", `./${rel}`], {
    cwd: root,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const line = out.split("\n").find((l) => l.startsWith("kg:export:judge")) ?? out.trim().split("\n").slice(-1)[0] ?? "";
  const findings = out.split("\n").filter((l) => /^\s+[✗?] /.test(l)).slice(0, 10);
  return { layer: rel, exit: r.status ?? 2, summary: [line, ...findings].join("\n") };
}

export function main(argv: readonly string[]): number {
  const at = argv.indexOf("--root");
  const root = resolve(at === -1 ? process.cwd() : argv[at + 1]!);
  const rows = layerRootsIn(root).map((i) => judge(root, i));
  for (const r of rows) console.log(`${r.exit === 0 ? "✓" : r.exit === 1 ? "✗" : "?"} ${r.layer}: ${r.summary}`);
  const v = verdictOf(rows);
  console.log(
    v === 0
      ? `jsonld:site:check: OK — ${rows.length} layer(s) render to their published JSON-LD`
      : v === 78
        ? "jsonld:site:check: not applicable — no layer in this checkout"
        : `jsonld:site:check: ${v === 1 ? "FAILED" : "COULD NOT DETERMINE (not a pass)"} — ` +
          `${rows.filter((r) => r.exit !== 0).length} of ${rows.length} layer(s) do not render`,
  );
  return v;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
