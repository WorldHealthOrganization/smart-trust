#!/usr/bin/env bun
/**
 * Check a DTH folio's personas, business processes and decision tables.
 *
 *   bun run folio-assistant-core/scripts/dth-block-check.ts --instance <name> [--repo .]
 *
 * These checks started in dth-hrh's local `scripts/glossary/validate.ts`
 * (litlfred/dth-hrh#64) and moved here so every DTH runs one copy
 * (core#515; owner decision Q-SPLIT-1 A). Glossary and ArchiMate links stay
 * in `glossary-validate.ts`; this script reads the structure of the blocks.
 *
 * For each block under `<repo>/folio/<instance>/`:
 *
 * - `persona(…)`: `meta.roleId`, at least one `meta.bpmnLanes` entry, at
 *   least one `meta.archimate.elements` entry and at least one glossary link
 *   (`meta.glossary` or `meta.glossaryTerms`). Each named lane exists in its
 *   `bpmnFile` with `partitionElementRef` equal to the persona's label.
 * - `businessProcess(…)`: its `.bpmn` companion exists and holds a
 *   `<bpmn:process>` with at least one `<bpmn:lane>`. Every lane's
 *   `partitionElementRef` names a declared persona, and `meta.svgFile`
 *   exists.
 * - `decisionTable(…)`: its `.dmn` companion exists and holds a decision
 *   table, `decisionId` is set, the table loads with `loadDecisionTable` (which
 *   refuses parse warnings) and has no unreadable FEEL expressions, and
 *   `meta.source.sourcePassages` names at least one file, each of which exists.
 * - `prose(…)`: its `.md` companion does not repeat a `table(…)` block of the
 *   same section as flattened PDF table text (markers `INPUTS STEPS RESOURCES`
 *   or `POTENTIAL RISKS MITIGATION`, work item `ftpc`).
 *
 * A companion is `meta.bpmnFile` / `meta.dmnFile` beside the block, or the
 * block's own name with `.bpmn` / `.dmn`. It reports each failure and exits
 * 1 if there is one, 2 on unusable input.
 *
 * @graphNode none, a check over a folio, not a schema
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { folioDir } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { loadDecisionTable, unreadableExpressions } from "@litlfred/cat-harness-tools/src/workflow/decision-table.ts";

import { metaOf } from "./glossary-validate.ts";

export interface Report {
  errors: string[];
  counts: { personas: number; processes: number; lanes: number; decisionTables: number; rules: number };
}

/** Flattened PDF step/risks table headers that must not be repeated in a prose block of a section with a table block. */
export const FLATTENED_TABLE_MARKERS = ["INPUTS STEPS RESOURCES", "POTENTIAL RISKS MITIGATION"] as const;

interface Lane {
  laneId?: unknown;
  bpmnFile?: unknown;
}

function walkTs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => (e.isDirectory() ? walkTs(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []));
}

/** The `<bpmn:lane …>` start tags of a BPMN file, as id → partitionElementRef. */
export function lanesOf(xml: string): Array<{ id: string | undefined; ref: string | undefined }> {
  return [...xml.matchAll(/<(?:bpmn2?:)?lane\b([^>]*)>/g)].map((m) => ({
    id: /\bid="([^"]+)"/.exec(m[1]!)?.[1],
    ref: /\bpartitionElementRef="([^"]+)"/.exec(m[1]!)?.[1],
  }));
}

/** Each `blocks: [ … ]` list in a chapter manifest, as an array of block file roots. */
export function sectionBlocksOf(src: string): string[][] {
  return [...src.matchAll(/\bblocks:\s*\[([^\]]*)\]/g)].map((m) =>
    [...m[1]!.matchAll(/"([^"]+)"/g)].map((q) => q[1]!),
  );
}

/** Flattened table markers present in `proseMd` when the section also holds at least one `table(…)` block. */
export function repeatedTableMarkers(proseMd: string, tableMds: readonly string[]): string[] {
  if (tableMds.length === 0) return [];
  const norm = (s: string) => s.replace(/[*_|`>#-]+/g, " ").replace(/\s+/g, " ");
  const pNorm = norm(proseMd);
  return FLATTENED_TABLE_MARKERS.filter((m) => pNorm.includes(m));
}

const stringField = (src: string, key: string) => new RegExp(`\\b${key}:\\s*"([^"]+)"`).exec(src)?.[1];

function companion(file: string, named: unknown, ext: string): string {
  return typeof named === "string" && named ? join(dirname(file), named) : file.replace(/\.ts$/, ext);
}

export async function check(repo: string, instance: string): Promise<Report> {
  const errors: string[] = [];
  const counts = { personas: 0, processes: 0, lanes: 0, decisionTables: 0, rules: 0 };
  const files = walkTs(join(folioDir(repo), instance)).map((f) => ({ f, src: readFileSync(f, "utf-8") }));
  const rel = (p: string) => (p.startsWith(repo + "/") ? p.slice(repo.length + 1) : p);

  // Personas first: a process lane must name one of them.
  const personaLabels = new Set<string>();
  for (const { f, src } of files) {
    if (!src.includes("export default persona(")) continue;
    counts.personas++;
    const label = stringField(src, "label");
    if (label) personaLabels.add(label);
    const meta = metaOf(src) ?? {};
    const lanes = Array.isArray(meta.bpmnLanes) ? (meta.bpmnLanes as Lane[]) : [];
    const glossary = [meta.glossary, meta.glossaryTerms].some((g) => Array.isArray(g) && g.length > 0);
    if (!meta.roleId) errors.push(`${rel(f)}: persona has no meta.roleId`);
    if (lanes.length === 0) errors.push(`${rel(f)}: persona has no meta.bpmnLanes`);
    if (!Array.isArray(meta.archimate?.elements) || meta.archimate.elements.length === 0) {
      errors.push(`${rel(f)}: persona has no meta.archimate.elements`);
    }
    if (!glossary) errors.push(`${rel(f)}: persona has no meta.glossary or meta.glossaryTerms`);
    for (const lane of lanes) {
      const bpmn = typeof lane.bpmnFile === "string" ? join(repo, lane.bpmnFile) : "";
      if (!bpmn || !existsSync(bpmn)) {
        errors.push(`${rel(f)}: lane ${String(lane.laneId)}: bpmnFile ${String(lane.bpmnFile)} does not exist`);
        continue;
      }
      const hit = lanesOf(readFileSync(bpmn, "utf-8")).find((l) => l.id === lane.laneId);
      if (!hit) errors.push(`${rel(f)}: lane ${String(lane.laneId)} is not in ${lane.bpmnFile}`);
      else if (hit.ref !== label) {
        errors.push(`${rel(f)}: lane ${String(lane.laneId)} in ${lane.bpmnFile} has partitionElementRef "${hit.ref ?? ""}", not "${label}"`);
      }
    }
  }

  for (const { f, src } of files) {
    const meta = metaOf(src) ?? {};
    if (src.includes("export default businessProcess(")) {
      counts.processes++;
      const bpmn = companion(f, meta.bpmnFile, ".bpmn");
      if (!existsSync(bpmn)) {
        errors.push(`${rel(f)}: BPMN companion ${rel(bpmn)} does not exist`);
      } else {
        const xml = readFileSync(bpmn, "utf-8");
        if (!/<(?:bpmn2?:)?process\b/.test(xml)) errors.push(`${rel(bpmn)}: has no <bpmn:process>`);
        const lanes = lanesOf(xml);
        if (lanes.length === 0) errors.push(`${rel(bpmn)}: has no <bpmn:lane>`);
        for (const l of lanes) {
          counts.lanes++;
          if (!l.ref) errors.push(`${rel(bpmn)}: lane ${l.id ?? "?"} has no partitionElementRef`);
          else if (!personaLabels.has(l.ref)) errors.push(`${rel(bpmn)}: lane ${l.id ?? "?"} names persona "${l.ref}", which no persona block declares`);
        }
      }
      const svg = typeof meta.svgFile === "string" ? join(folioDir(repo), instance, meta.svgFile) : "";
      if (!svg || !existsSync(svg)) errors.push(`${rel(f)}: rendered SVG ${String(meta.svgFile ?? "(meta.svgFile not set)")} does not exist`);
    }

    if (src.includes("export default decisionTable(")) {
      counts.decisionTables++;
      const dmn = companion(f, meta.dmnFile, ".dmn");
      const decisionId = stringField(src, "decisionId");
      if (!existsSync(dmn)) errors.push(`${rel(f)}: DMN companion ${rel(dmn)} does not exist`);
      else if (!/<(?:dmn\d*:)?decisionTable\b/.test(readFileSync(dmn, "utf-8"))) errors.push(`${rel(dmn)}: has no decision table`);
      else if (!decisionId) errors.push(`${rel(f)}: decision table has no decisionId`);
      else {
        try {
          const table = await loadDecisionTable(dmn, decisionId);
          counts.rules += table.rules.length;
          const unreadable = unreadableExpressions(table);
          if (unreadable.length) errors.push(`${rel(dmn)}: ${unreadable.length} unreadable FEEL expression(s)`);
        } catch (e) {
          errors.push(`${rel(dmn)}: does not load: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      const source = (meta.source ?? {}) as Record<string, unknown>;
      const passages = Array.isArray(source.sourcePassages) ? (source.sourcePassages as unknown[]) : [];
      if (passages.length === 0) errors.push(`${rel(f)}: decision table cites no meta.source.sourcePassages`);
      for (const p of passages) {
        if (typeof p !== "string" || !existsSync(join(repo, p))) errors.push(`${rel(f)}: source passage ${String(p)} does not exist`);
      }
    }

    if (src.includes("export default chapter(")) {
      const chDir = dirname(f);
      for (const blocks of sectionBlocksOf(src)) {
        const proseRoots: Array<{ root: string; mdPath: string; md: string }> = [];
        const tableMds: Array<{ root: string; md: string }> = [];
        for (const root of blocks) {
          const tsPath = join(chDir, `${root}.ts`);
          const mdPath = join(chDir, `${root}.md`);
          if (!existsSync(tsPath) || !existsSync(mdPath)) continue;
          const bSrc = readFileSync(tsPath, "utf-8");
          if (bSrc.includes("export default prose(")) {
            proseRoots.push({ root, mdPath, md: readFileSync(mdPath, "utf-8") });
          } else if (bSrc.includes("export default table(")) {
            tableMds.push({ root, md: readFileSync(mdPath, "utf-8") });
          }
        }
        if (tableMds.length === 0) continue;
        const norm = (s: string) => s.replace(/[*_|`>#-]+/g, " ").replace(/\s+/g, " ");
        const allTables = tableMds.map((t) => t.root).join(", ");
        for (const p of proseRoots) {
          for (const marker of repeatedTableMarkers(p.md, tableMds.map((t) => t.md))) {
            const matching = tableMds.filter((t) => norm(t.md).includes(marker)).map((t) => t.root).join(", ") || allTables;
            errors.push(`${rel(p.mdPath)}: prose block repeats flattened table text "${marker}" from section table(s) ${matching}`);
          }
        }
      }
    }
  }
  return { errors, counts };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const at = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const instance = at("--instance");
  if (!instance) {
    console.error("usage: dth-block-check.ts --instance <name> [--repo .]");
    process.exit(2);
  }
  const r = await check(at("--repo") ?? ".", instance);
  const c = r.counts;
  console.log(`· ${c.personas} persona(s); ${c.processes} business process(es) with ${c.lanes} lane(s); ${c.decisionTables} decision table(s) with ${c.rules} rule(s)`);
  for (const e of r.errors) console.error(`✗ ${e}`);
  console.log(r.errors.length ? `✗ ${r.errors.length} problem(s)` : "✓ personas, processes and decision tables check out");
  process.exit(r.errors.length ? 1 : 0);
}
