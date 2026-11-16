#!/usr/bin/env bun
/**
 * gen-upload-step-docs.ts — the reference page for document ingestion's FIRST
 * step, generated from the Tool nodes that implement it: process step →
 * skill → Tool → page.
 *
 * ## Nothing about WHICH step is written here
 *
 * The process file is named and everything else is DERIVED from it: the start
 * event, the activity its only outgoing flow reaches, that activity's
 * `<bootstrap.processes:skill ref>`, and every Tool whose `satisfies` names
 * that skill. Inserting, renaming or re-pointing a step moves the page rather
 * than staling a literal.
 *
 * It IMPORTS both graphs rather than parsing them (as `gen-tools-viz` does),
 * so it reads them exactly as the server does.
 *
 * ## What it refuses rather than papers over
 *
 * - the named process file missing, or its start event flowing nowhere;
 * - a first activity naming no skill, or naming more than one (picking is a
 *   judgement a generator may not make);
 * - **no Tool satisfying that skill**: an empty page would read as "this
 *   step has no mechanism", which is a finding, not a document.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/gen-upload-step-docs.ts
 *   bun run cat-harness-tools/scripts/gen-upload-step-docs.ts --check
 *
 * @module cat-harness/scripts/gen-upload-step-docs
 * @covers tools, processes
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { loadProcessModel, type ProcessModel, type ProcessNode } from "../src/workflow/process-model.ts";
import { siteDirFor } from "../schemas/kg/cat-harness.ts";
import { tools } from "../schemas/tools/harness-tools.ts";
import type { ToolDefinition } from "../schemas/tools/tool.ts";
import { corpusDirectoriesForGraph } from "../schemas/kg/harness-config.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);

/**
 * The process whose first step this documents.
 *
 * The one FILENAME written here, and it is the subject rather than the answer
 * — every other fact is read out of the diagram. Its DIRECTORY is not written:
 * `processes/` is a declared graph, so it is asked for rather than composed,
 * which is what stops this generator from being the file that keeps working
 * after the graph moves and quietly documents nothing.
 */
const PROCESS_FILE = "document-ingestion.bpmn";

/**
 * The declared `processes` directory that holds it — ASKED, and asked of all
 * of them.
 *
 * `directoryForGraph` is the wrong call here and says so when you make it:
 * three directories declare this graph (`processes/`,
 * the DAK base layer's `methodologies/processes/`,
 * the content core's `processes/`), and picking the first silently is bean
 * `wggr`, which resolved a graph to the wrong directory and wrote 37 sidecars
 * against the wrong subjects on a run that exited 0. So every declared
 * directory is searched, exactly one must hold the file, and both other
 * answers — none, or several — refuse.
 */
/** Every file called `name` under `dir`, at any depth. */
function filesNamed(dir: string, name: string): string[] {
  if (!existsSync(dir)) return [];
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((rel) => basename(rel) === name)
    .map((rel) => join(dir, rel));
}

function processPath(): string {
  const dirs = corpusDirectoriesForGraph(INSTANCE_ROOT, "processes");
  if (dirs.length === 0) {
    throw new CannotDerive(
      `${INSTANCE_ROOT} declares no \`processes\` graph, so there is no diagram to read ` +
        `\`${PROCESS_FILE}\` from`,
    );
  }
  // At ANY depth: since placement PR3 (bean `63wl`) a declared `processes/`
  // groups its diagrams by concern, so the file sits in `processes/<group>/`.
  const hits = dirs.flatMap((d) => filesNamed(d, PROCESS_FILE));
  if (hits.length === 1) return hits[0]!;
  if (hits.length === 0) {
    throw new CannotDerive(
      `no declared \`processes\` directory holds \`${PROCESS_FILE}\` — searched ${dirs.join(", ")}`,
    );
  }
  throw new CannotDerive(
    `${hits.length} declared \`processes\` directories hold \`${PROCESS_FILE}\` (${hits.join(", ")}); ` +
      `which one this page documents is a decision, not a lookup`,
  );
}

const OUT = join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT), "reference", "upload-step", "index.md");

const CHECK_ONLY = process.argv.includes("--check");

/** A refusal that names the fact it could not establish. Never a partial page. */
export class CannotDerive extends Error {}

/** The activity the start event flows into — the process's first real step. */
export function firstActivity(model: ProcessModel): ProcessNode {
  const start = model.startNodes[0];
  if (!start) throw new CannotDerive(`${model.source}: no start event`);
  const out = [...model.flows.values()].filter((f) => f.from === start);
  if (out.length !== 1) {
    throw new CannotDerive(
      `${model.source}: the start event has ${out.length} outgoing flow(s); ` +
        `"the first step" is only a determined answer when there is exactly one`,
    );
  }
  const node = model.nodes.get(out[0]!.to);
  if (!node) throw new CannotDerive(`${model.source}: ${out[0]!.to} is not a node`);
  if (node.kind !== "activity") {
    throw new CannotDerive(
      `${model.source}: the start event reaches ${node.id} (${node.kind}), not an activity — ` +
        `the process still begins with something nobody performs`,
    );
  }
  return node;
}

/** Markdown-safe: a cell may not break the table it is in. */
function cell(s: string | undefined): string {
  return (s ?? "").replace(/[\\|]/g, "\\$&").replace(/\r?\n/g, " ").trim();
}

function invocationOf(tool: ToolDefinition): string {
  const i = tool.invoke as Record<string, unknown> | undefined;
  if (!i) return "_not declared_";
  if (typeof i.shell === "string") return "`" + i.shell + "`";
  if (typeof i.container === "string") return "container `" + i.container + "`";
  const mcp = i.mcp as { tool?: string } | undefined;
  if (mcp?.tool) return "MCP tool `" + mcp.tool + "`";
  if (i.manual === true) return "performed by hand — no invocation";
  return "_not declared_";
}

function installOf(tool: ToolDefinition): string {
  const i = tool.install as Record<string, unknown> | undefined;
  if (!i) return "_not declared_";
  if (i.none === true) return "nothing to install";
  if (typeof i.cli === "string") return "`" + i.cli + "`";
  if (typeof i.container === "string") return "container `" + i.container + "`";
  if (typeof i.service === "string") return "service `" + i.service + "`";
  return "_not declared_";
}

function toolSection(tool: ToolDefinition): string[] {
  const L: string[] = [];
  L.push(`## ${tool.title}`);
  L.push("");
  L.push(`\`${tool.id}\` · satisfies ${tool.satisfies.map((s) => "`" + s + "`").join(", ")}`);
  L.push("");
  L.push(tool.description);
  L.push("");
  L.push("| | |");
  L.push("|---|---|");
  L.push(`| install | ${cell(installOf(tool))} |`);
  L.push(`| invoke | ${cell(invocationOf(tool))} |`);
  const req = tool.requires;
  if (req) {
    const bits: string[] = [];
    if (req.runtime?.length) bits.push(`runtime ${req.runtime.map((r) => "`" + r + "`").join(", ")}`);
    if (req.os?.length) bits.push(`os ${req.os.map((r) => "`" + r + "`").join(", ")}`);
    if (req.network !== undefined) bits.push(req.network ? "needs the network" : "no network");
    if (bits.length) L.push(`| requires | ${cell(bits.join(" · "))} |`);
  }
  L.push("");

  if (tool.io.inputs.length > 0) {
    L.push("### Inputs");
    L.push("");
    L.push("| name | required | how it is passed | what it is |");
    L.push("|---|---|---|---|");
    for (const p of tool.io.inputs) {
      const a = p.arg as Record<string, unknown> | undefined;
      const how =
        a && typeof a.flag === "string"
          ? "`" + a.flag + "`"
          : a && typeof a.positional === "number"
            ? `positional ${a.positional}`
            : "—";
      L.push(`| \`${p.name}\` | ${p.required ? "yes" : "no"} | ${cell(how)} | ${cell(p.description) || "—"} |`);
    }
    L.push("");
  }
  if (tool.io.outputs.length > 0) {
    L.push("### Outputs");
    L.push("");
    L.push("| name | what it is |");
    L.push("|---|---|");
    for (const p of tool.io.outputs) L.push(`| \`${p.name}\` | ${cell(p.description) || "—"} |`);
    L.push("");
  }

  // The selection triple, printed with its three questions named. A Tool that
  // declares none says so: `selection` is optional in the schema, and an
  // absent one is a gap in the Tool's documentation rather than a gap here.
  if (tool.selection) {
    L.push("### Choosing it");
    L.push("");
    L.push(`**When.** ${tool.selection.when}`);
    L.push("");
    L.push(`**Limits.** ${tool.selection.limits}`);
    L.push("");
    L.push(`**Cost.** ${tool.selection.cost}`);
    L.push("");
  } else {
    L.push("### Choosing it");
    L.push("");
    L.push(
      "_This Tool declares no `selection`, so when to reach for it, what it will not do " +
        "and what it costs are undocumented. That is a gap in the Tool node, not on this page._",
    );
    L.push("");
  }
  return L;
}

export function render(model: ProcessModel, step: ProcessNode, matched: ToolDefinition[]): string {
  const L: string[] = [];
  L.push("---");
  L.push("layout: default");
  L.push("generated: cat-harness-tools/scripts/gen-upload-step-docs.ts — do not hand-edit; edit the Tool nodes");
  L.push("title: The upload step");
  L.push("nav_order: 44");
  L.push("---");
  L.push("");
  L.push("# The upload step");
  L.push("");
  L.push(
    "The **first step of document ingestion** — what puts a file into the queue " +
      "everything downstream assumes it is already in — and the Tools that perform it.",
  );
  L.push("");
  L.push("{: .note }");
  L.push(
    "> Generated from the **Tool documentation** and from the process diagram. " +
      "Nothing here is authored on this page: edit the Tool node or the `.bpmn` and re-run " +
      "`bun run cat-harness-tools/scripts/gen-upload-step-docs.ts`.",
  );
  L.push("");
  L.push("## Where this step sits");
  L.push("");
  L.push("| | |");
  L.push("|---|---|");
  L.push(`| process | ${cell(model.name)} (\`${model.id}\`) |`);
  L.push(`| begins at | ${cell(model.nodes.get(model.startNodes[0]!)?.name)} |`);
  L.push(`| first step | **${cell(step.name)}** (\`${step.id}\`) |`);
  L.push(`| performed in the lane | ${cell(step.lane) || "—"}${step.roleRef ? ` (role \`${step.roleRef}\`)` : ""} |`);
  L.push(`| governed by the skill | \`${step.skills[0]}\` |`);
  L.push(`| Tools that satisfy it | ${matched.length} |`);
  L.push("");
  if (step.documentation) {
    L.push("What the diagram says about the step itself:");
    L.push("");
    for (const para of step.documentation.split(/\n\s*\n/)) {
      const t = para.trim();
      if (t) {
        L.push("> " + t.replace(/\n/g, "\n> "));
        L.push(">");
      }
    }
    if (L[L.length - 1] === ">") L.pop();
    L.push("");
  }
  L.push(
    `The skill is the prose an actor reads; each Tool below is one concrete way to ` +
      `exercise it. See [\`${step.skills[0]}\`](../skill-instructions/${step.skills[0]}.html).`,
  );
  L.push("");
  for (const tool of matched) L.push(...toolSection(tool));
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

async function main(): Promise<void> {
  const model = await loadProcessModel(processPath());
  const step = firstActivity(model);
  if (step.skills.length !== 1) {
    throw new CannotDerive(
      `${step.id} names ${step.skills.length} skill(s); this page documents the Tools of ONE, ` +
        `and choosing between them is a judgement a generator may not make`,
    );
  }
  const skill = step.skills[0]!;
  const matched = tools()
    .filter((t) => t.satisfies.includes(skill))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (matched.length === 0) {
    throw new CannotDerive(
      `no Tool declares \`satisfies: ["${skill}"]\` — the step has no mechanism, ` +
        `which is a finding rather than a page`,
    );
  }

  const next = render(model, step, matched);
  const current = existsSync(OUT) ? readFileSync(OUT, "utf-8") : null;
  if (CHECK_ONLY) {
    if (current === next) {
      console.log(`✓ ${OUT} is current (${matched.length} Tool(s) for \`${skill}\`)`);
      return;
    }
    console.error(
      `✗ ${OUT} is ${current === null ? "missing" : "stale"}.\n` +
        `Run \`bun run cat-harness-tools/scripts/gen-upload-step-docs.ts\` and commit.`,
    );
    process.exitCode = 1;
    return;
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, next);
  console.log(`✓ ${OUT} — ${matched.length} Tool(s) for \`${skill}\`: ${matched.map((t) => t.id).join(", ")}`);
}

if (import.meta.main) {
  try {
    await main();
  } catch (e) {
    if (e instanceof CannotDerive) {
      console.error(`cannot derive the upload step's page: ${e.message}`);
      process.exitCode = 1;
    } else throw e;
  }
}
