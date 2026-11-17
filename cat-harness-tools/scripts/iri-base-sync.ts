#!/usr/bin/env bun
/**
 * Keep each layer's declared `iriBase` equal to what its publishing profile
 * derives.
 *
 * @module scripts/iri-base-sync
 * @graphNode none — a writer and its check over index.config.json `publish` and the declarations
 *
 * WHO migration, plan step T3 (cat-harness-tools#2337). The rule and the
 * profile are `schemas/kg/publishing-profile.ts`: a layer whose entry in
 * `index.config.json` carries `publish` has its `iriBase` DERIVED, and the
 * declaration only carries the value so that it travels with the layer into
 * checkouts that mount it. A layer with no `publish` is not judged.
 *
 *   bun run cat iri-base:check   # exit 1 when a declaration disagrees
 *   bun run cat iri-base:sync    # rewrite the `iriBase` line of each that does
 *
 * The repository name in a staged IRI base is this checkout's (from
 * `origin`, else the directory), which is the same in a fork and upstream.
 *
 * Exit codes: 0 current (or nothing declares `publish`) · 1 drift · 2 unreadable input.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { readIndexConfig } from "../schemas/kg/index-config.ts";
import { findDeclarationFile } from "../schemas/kg/instance-roots.ts";
import { computeIriBase, LayerPublishSchema, profileFor } from "../schemas/kg/publishing-profile.ts";
import { checkoutName } from "./workflow-pins.ts";

export interface IriBaseFinding {
  layer: string;
  file: string;
  have: string | undefined;
  want: string;
}

/** Every layer at `root` whose declared `iriBase` is not what its `publish` derives. */
export function iriBaseDrift(root: string, repo = checkoutName(root) || basename(root)): { findings: IriBaseFinding[]; judged: number; problems: string[] } {
  const idx = readIndexConfig(root);
  if (idx.state === "absent") return { findings: [], judged: 0, problems: [] };
  if (idx.state !== "ok") return { findings: [], judged: 0, problems: [`${idx.file}: ${"why" in idx ? idx.why : "unreadable"}`] };
  const findings: IriBaseFinding[] = [];
  const problems: string[] = [];
  let judged = 0;
  for (const entry of idx.config.instances) {
    const raw = (entry as { publish?: unknown }).publish;
    if (raw === undefined) continue;
    const p = LayerPublishSchema.safeParse(raw);
    if (!p.success) {
      problems.push(`${entry.name}: \`publish\` is malformed: ${p.error.issues[0]?.path.join(".")} ${p.error.issues[0]?.message}`);
      continue;
    }
    const src = entry.source;
    if (src === undefined || !("local" in src)) {
      problems.push(`${entry.name}: \`publish\` is declared on a layer this checkout does not hold (no source.local)`);
      continue;
    }
    const dir = join(root, src.local.at);
    const declName = findDeclarationFile(dir);
    if (!declName) {
      problems.push(`${entry.name}: no declaration in ${src.local.at}`);
      continue;
    }
    let want: string;
    try {
      want = computeIriBase(profileFor(root, p.data), p.data, repo);
    } catch (e) {
      problems.push(`${entry.name}: ${(e as Error).message}`);
      continue;
    }
    judged++;
    const file = join(dir, declName);
    const have = (JSON.parse(readFileSync(file, "utf-8")) as { iriBase?: string }).iriBase;
    if (have !== want) findings.push({ layer: entry.name, file, have, want });
  }
  return { findings, judged, problems };
}

/** Rewrite each drifted declaration's `iriBase` line in place; a declaration with none is reported, not edited. */
export function syncIriBase(root: string, repo?: string): { fixed: IriBaseFinding[]; unfixed: IriBaseFinding[]; problems: string[] } {
  const r = iriBaseDrift(root, repo);
  const fixed: IriBaseFinding[] = [];
  const unfixed: IriBaseFinding[] = [];
  for (const f of r.findings) {
    const text = readFileSync(f.file, "utf-8");
    const re = /("iriBase"\s*:\s*)"[^"]*"/;
    if (f.have === undefined || !re.test(text)) {
      unfixed.push(f);
      continue;
    }
    writeFileSync(f.file, text.replace(re, `$1${JSON.stringify(f.want)}`));
    fixed.push(f);
  }
  return { fixed, unfixed, problems: r.problems };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--root");
  const root = resolve(i >= 0 ? argv[i + 1]! : process.cwd());
  if (argv.includes("--write")) {
    const r = syncIriBase(root);
    for (const f of r.fixed) console.log(`iri-base:sync: ${f.layer}: ${f.have} → ${f.want}`);
    for (const f of r.unfixed) console.error(`iri-base:sync: ${f.layer}: ${f.file} has no "iriBase" line to rewrite; add "iriBase": ${JSON.stringify(f.want)}`);
    for (const p of r.problems) console.error(`iri-base:sync: ${p}`);
    process.exit(r.problems.length ? 2 : r.unfixed.length ? 1 : 0);
  }
  const r = iriBaseDrift(root);
  for (const p of r.problems) console.error(`iri-base:check: ${p}`);
  for (const f of r.findings) console.error(`iri-base:check: ${f.layer}: iriBase is ${f.have ?? "absent"}, the profile derives ${f.want} — run \`bun run cat iri-base:sync\``);
  if (r.problems.length) process.exit(2);
  console.log(`iri-base:check: ${r.judged} layer(s) declare \`publish\`; ${r.findings.length} drifted`);
  process.exit(r.findings.length ? 1 : 0);
}
