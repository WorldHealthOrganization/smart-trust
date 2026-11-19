#!/usr/bin/env bun
/**
 * Derive UML data class diagrams (from `DataObject` / `BusinessObject` elements,
 * `logical-model` tags and FSH `Logical:` definitions) and sequence diagrams
 * (from `ApplicationInteraction`s, `Flow` / `Triggering` chains, and BPMN
 * collaboration / cross-lane handoffs) for each ArchiMate model of a layer.
 * The Tool `archimate-diagrams` (smart-ra#166 D5).
 *
 * @module cat-harness/archimate/scripts/archimate-diagrams
 * @conformsTo opengroup-archimate-3.0
 * @covers archimate
 *
 * Usage:
 *   bun run cat archimate:diagrams --instance <dir> [--model <id>] [--kind all|data|sequence] [--format text|json|puml|mmd|dot|md] [--fsh <path>] [--bpmn <path>] [--out <file> [--check]]
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { readArchimate } from "../schemas/archimate.ts";
import {
  dataModelDot,
  dataModelMarkdown,
  dataModelMermaid,
  dataModelOf,
  dataModelPuml,
  parseFshLogicalModels,
  sequencesMarkdown,
  sequencesMermaid,
  sequencesOf,
  sequencesPuml,
  type DataModel,
  type FshLogicalModel,
  type SequenceSet,
} from "../schemas/diagrams.ts";
import { typeName, verbOf } from "../schemas/metamodel.ts";
import { archimateDir, readConfig } from "./check-archimate.ts";

export const TOOL_ID = "archimate-diagrams";
const KINDS = ["all", "data", "sequence"] as const;
type Kind = (typeof KINDS)[number];
const FORMATS = ["text", "json", "puml", "mmd", "dot", "md"] as const;
type Format = (typeof FORMATS)[number];

export interface ModelDiagrams {
  model: string;
  dataModel: DataModel;
  sequences: SequenceSet;
}

function collectFiles(targetPath: string, ext: string): string[] {
  if (!existsSync(targetPath)) return [];
  const st = statSync(targetPath);
  if (st.isFile()) return targetPath.endsWith(ext) ? [targetPath] : [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(ext)) out.push(p);
    }
  };
  walk(targetPath);
  return out.sort();
}

/** Read FSH `Logical:` models from a file or directory (defaulting to `<instance>/input/fsh/models`). */
export function readFshLogicalModels(instanceRoot: string, fshPath?: string): FshLogicalModel[] {
  const target = fshPath ? resolve(instanceRoot, fshPath) : join(instanceRoot, "input", "fsh", "models");
  const files = collectFiles(target, ".fsh");
  return files.flatMap((f) => parseFshLogicalModels(readFileSync(f, "utf8")));
}

/** Read BPMN 2.0 XML files from a file or directory. */
export function readBpmnInputs(instanceRoot: string, bpmnPath?: string): Array<{ id: string; xml: string }> {
  if (!bpmnPath) return [];
  const files = collectFiles(resolve(instanceRoot, bpmnPath), ".bpmn");
  return files.map((f) => ({ id: basename(f, ".bpmn"), xml: readFileSync(f, "utf8") }));
}

/** Derive the data class diagram and sequence diagrams for every configured model (or one). */
export function diagramsFor(
  instanceRoot: string,
  opts: { model?: string; fshPath?: string; bpmnPath?: string } = {},
): ModelDiagrams[] {
  const config = readConfig(instanceRoot);
  const dir = archimateDir(instanceRoot, config);
  const models = config.models.filter((m) => opts.model === undefined || m.id === opts.model);
  if (opts.model !== undefined && models.length === 0) {
    throw new Error(`no model "${opts.model}" in ${config.models.map((m) => m.id).join(", ")}`);
  }
  const logicalModels = readFshLogicalModels(instanceRoot, opts.fshPath);
  const bpmn = readBpmnInputs(instanceRoot, opts.bpmnPath);
  return models.map((cm) => {
    const parsed = readArchimate(readFileSync(join(dir, cm.file)));
    return {
      model: cm.id,
      dataModel: dataModelOf(parsed, cm.id, { logicalModels }),
      sequences: sequencesOf(parsed, cm.id, { bpmn }),
    };
  });
}

/** Plain-text summary of a model's derived data class diagram and sequence diagrams. */
export function reportDiagrams(d: ModelDiagrams, kind: Kind = "all"): string {
  const lines: string[] = [];
  if (kind === "all" || kind === "data") {
    const dm = d.dataModel;
    const tagged = dm.classes.filter((c) => c.logicalModel !== undefined).length;
    lines.push(
      `${dm.model} (${dm.name}) — data model: ${dm.classes.length} class(es) (${tagged} tagged logical-model), ${dm.relationships.length} relationship(s)`,
    );
    if (dm.problems.length > 0) {
      for (const p of dm.problems) lines.push(`  ✗ ${p}`);
    } else {
      lines.push("  ✓ all logical-model tags valid");
    }
    for (const c of dm.classes) {
      lines.push(
        `  • ${c.name} (${typeName(c.type)})${c.logicalModel ? ` [${c.logicalModel}]` : ""}: ${c.attributes.length} attribute(s), ${c.accessedBy.length} accessor(s)`,
      );
    }
    const nameOf = new Map(dm.classes.map((c) => [c.id, c.name]));
    for (const r of dm.relationships) {
      const detail = [r.role, r.cardinality ? `[${r.cardinality}]` : undefined].filter(Boolean).join(" ") || r.name || "";
      lines.push(`    ${nameOf.get(r.source) ?? r.source} ${verbOf(r.type)} ${nameOf.get(r.target) ?? r.target}${detail ? ` (${detail})` : ""}`);
    }
  }
  if (kind === "all" || kind === "sequence") {
    const sq = d.sequences;
    lines.push(`${sq.model} (${sq.name}) — sequences: ${sq.sequences.length} derived sequence diagram(s)`);
    for (const s of sq.sequences) {
      lines.push(`  • ${s.title} (${s.source}): ${s.participants.length} participant(s), ${s.messages.length} message(s)`);
    }
  }
  return lines.join("\n");
}

/** Format one model's diagrams into `puml`, `mmd`, `dot`, `md`, `json`, or `text`. */
export function formatDiagrams(d: ModelDiagrams, kind: Kind, format: Format): string {
  if (format === "text") return `${reportDiagrams(d, kind)}\n`;
  if (format === "json") {
    const payload = kind === "data" ? d.dataModel : kind === "sequence" ? d.sequences : d;
    return `${JSON.stringify(payload, null, 2)}\n`;
  }
  if (format === "dot") {
    if (kind === "sequence") throw new Error("--format dot is supported for data class diagrams (--kind data)");
    return dataModelDot(d.dataModel);
  }
  if (format === "puml") {
    if (kind === "data") return dataModelPuml(d.dataModel);
    if (kind === "sequence") return sequencesPuml(d.sequences);
    return `${dataModelPuml(d.dataModel)}\n${sequencesPuml(d.sequences)}`;
  }
  if (format === "mmd") {
    if (kind === "data") return dataModelMermaid(d.dataModel);
    if (kind === "sequence") return sequencesMermaid(d.sequences);
    return `${dataModelMermaid(d.dataModel)}\n${sequencesMermaid(d.sequences)}`;
  }
  // format === "md"
  if (kind === "data") return dataModelMarkdown(d.dataModel);
  if (kind === "sequence") return sequencesMarkdown(d.sequences);
  return `${dataModelMarkdown(d.dataModel)}\n${sequencesMarkdown(d.sequences)}`;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const instance = arg("instance");
  const kind = (arg("kind") ?? "all") as Kind;
  const format = (arg("format") ?? "text") as Format;
  if (!instance || !KINDS.includes(kind) || !FORMATS.includes(format)) {
    console.error(
      `usage: archimate-diagrams.ts --instance <dir> [--model <id>] [--kind ${KINDS.join("|")}] [--format ${FORMATS.join("|")}] [--fsh <path>] [--bpmn <path>] [--out <file> [--check]]`,
    );
    process.exit(2);
  }
  const root = resolve(instance);
  const all = diagramsFor(root, { model: arg("model"), fshPath: arg("fsh"), bpmnPath: arg("bpmn") });
  if ((format === "puml" || format === "mmd" || format === "dot" || format === "md") && all.length !== 1) {
    console.error(`--format ${format} renders one model: pass --model (${all.map((m) => m.model).join(", ")})`);
    process.exit(2);
  }
  const rendered =
    format === "json" && all.length > 1
      ? `${JSON.stringify(all, null, 2)}\n`
      : all.map((d) => formatDiagrams(d, kind, format)).join("\n");

  const out = arg("out");
  const check = process.argv.includes("--check");
  let stale = false;
  if (out === undefined) {
    process.stdout.write(rendered);
  } else if (check) {
    const file = resolve(root, out);
    stale = !existsSync(file) || readFileSync(file, "utf8") !== rendered;
    console.log(stale ? `✗ ${out} is stale: run without --check` : `✓ ${out} is current`);
  } else {
    writeFileSync(resolve(root, out), rendered);
    console.log(`wrote ${out}`);
  }
  const hasProblems = all.some((d) => d.dataModel.problems.length > 0);
  if ((check && stale) || (check && hasProblems)) process.exit(1);
}
