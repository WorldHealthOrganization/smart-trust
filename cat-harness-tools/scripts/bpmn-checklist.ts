#!/usr/bin/env bun
/**
 * A checklist projection of every BPMN diagram.
 *
 * **A rendering, never an authority.** The checklist is the diagram walked as
 * a state machine, emitted FROM the `.bpmn`; it says so in its own first
 * line, and `--check` fails when one is stale — the discipline
 * `render:bpmn:check` holds the SVGs to. The engine (`workflow_start` /
 * `workflow_next` / `workflow_complete`) stays the authority on which edge was
 * taken: every step names the call that records it, so a wrong turn is
 * visible and refusable.
 *
 * How it follows the edges:
 *   1. each task is a step that ENDS with `next:` naming the node(s) it flows
 *      to by id — order is never inferred from position;
 *   2. a decision (exclusive gateway with more than one way out) is a
 *      "Decide" step: each branch's label → where it goes, or, when a DMN
 *      table computes it, the table by id and the `facts` call; a parallel
 *      fork is "do all of …", a join is "wait for all of …";
 *   3. start and end events are the entry and exit lines.
 * An agent with no MCP can walk 1–3 by hand; the engine calls each step names
 * make it auditable.
 *
 * ## Committed, beside the diagram, in the layer that owns it
 *
 * Checklists are committed, so `bpmn:checklist:check` compares committed
 * bytes: `<dir>/<stem>.bpmn` → `<dir>/<stem>.checklist.md`.
 *
 * - Not one shared directory: that would put every layer's diagrams inside
 *   cat-harness, referencing upward, and turn its check red whenever a layer
 *   above edits a diagram.
 * - Not the owner's site directory: a diagram's directory is mounted wherever
 *   the diagram is, while a site directory may be built and never committed
 *   (the DAK base layer's `docs/`).
 * - **Except below the harness.** bootstrap and bootstrap-tools must not refer
 *   to a harness, and a checklist names `workflow_complete` and this
 *   generator. So the harness holds theirs, in its own site's
 *   `assets/workflows/checklists/`.
 *
 * The source line a checklist cites is `<instance>/<path within it>`, so it is
 * the same text in an index checkout and in the owner's own repository.
 *
 * Usage:
 *   bun run cat bpmn:checklist          # write every diagram's checklist where it is committed
 *   bun run cat bpmn:checklist:check    # exit 1 if any is stale, missing or orphaned
 *   … [--out <dir>]                      # write them all into one directory instead
 *
 * @covers processes — every declared BPMN diagram, and the committed checklist beside it
 * @module scripts/bpmn-checklist
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

import { layerRootsIn, readDeclaration, repoRootFor, siteDirFor } from "../schemas/kg/cat-harness.ts";
import { loadProcessModel, processDiagrams, type ProcessModel, type ProcessNode } from "../src/workflow/process-model.ts";
import { belowHarness } from "./lib/needs-reach.ts";
import { workflowFiles } from "./known-skills.js";
import { gateOwnsFile } from "./lib/gate-own.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

const GENERATOR = "cat-harness-tools/scripts/bpmn-checklist.ts";

/** Nodes in walk order: breadth-first from the start events, outgoing flows in document order. */
function walkOrder(model: ProcessModel): ProcessNode[] {
  const seen = new Set<string>();
  const order: ProcessNode[] = [];
  const queue = [...model.startNodes];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    const node = model.nodes.get(id);
    if (!node) continue;
    seen.add(id);
    order.push(node);
    for (const f of node.outgoing) {
      const to = model.flows.get(f)?.to;
      if (to && !seen.has(to)) queue.push(to);
    }
    // A boundary event follows the step it sits on.
    for (const b of model.nodes.values()) if (b.attachedTo === id && !seen.has(b.id)) queue.unshift(b.id);
  }
  // Anything unreachable from a start event is still listed — silently
  // dropping it would make the checklist disagree with the diagram.
  for (const n of model.nodes.values()) if (!seen.has(n.id)) order.push(n);
  return order;
}

const firstSentence = (s: string | undefined): string | undefined => {
  if (!s) return undefined;
  const t = s.replace(/\s+/g, " ").trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  return (m ? m[1]! : t).slice(0, 300);
};

function ref(model: ProcessModel, id: string): string {
  const n = model.nodes.get(id);
  return n && n.name && n.name !== id ? `\`${id}\` (${n.name})` : `\`${id}\``;
}

function nextLine(model: ProcessModel, node: ProcessNode): string {
  const tos = node.outgoing.map((f) => model.flows.get(f)?.to).filter((x): x is string => !!x);
  return tos.length === 0 ? "next: — (no outgoing flow)" : `next: ${tos.map((t) => `→ ${ref(model, t)}`).join(", ")}`;
}

/** The checklist text for one diagram. `sourceRel` is how the header names the `.bpmn`. */
export function checklistFor(model: ProcessModel, sourceRel: string): string {
  const out: string[] = [];
  out.push(
    `<!-- GENERATED from ${sourceRel} by ${GENERATOR}. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->`,
    "",
    `# Checklist — ${model.name || model.id}`,
    "",
    `> **Generated, and not the authority.** This is \`${sourceRel}\` (process \`${model.id}\`) walked as a state machine. ` +
      "The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, " +
      "and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.",
    "",
  );
  const doc = firstSentence(model.documentation);
  if (doc) out.push(doc, "");
  let step = 0;
  for (const n of walkOrder(model)) {
    const head = n.name && n.name !== n.id ? `${n.name} (\`${n.id}\`)` : `\`${n.id}\``;
    if (n.kind === "start") {
      out.push(`## Begin — ${head}`, "");
      out.push(`- Begin here${firstSentence(n.documentation) ? `: ${firstSentence(n.documentation)}` : "."}`);
      out.push(`- Call \`workflow_start\` with \`process: "${model.id}"\` and the subject this run is about; keep the instance id it returns.`);
      out.push(`- ${nextLine(model, n)}`, "");
    } else if (n.kind === "end") {
      out.push(`## Done — ${head}`, "");
      out.push(`- The instance completes here${firstSentence(n.documentation) ? `: ${firstSentence(n.documentation)}` : "."} \`workflow_next\` then reports nothing enabled — that, not this line, is the record of completion.`, "");
    } else if (n.kind === "activity") {
      step += 1;
      out.push(`### ${step}. ${head}`, "");
      if (n.lane) out.push(`- Who: the \`${n.lane}\` lane${n.roleRef ? ` (role \`${n.roleRef}\`)` : ""}.`);
      if (n.skills.length > 0) out.push(`- Skill: ${n.skills.map((s) => `\`${s}\``).join(", ")}.`);
      const d = firstSentence(n.documentation);
      if (d) out.push(`- What: ${d}`);
      if (n.globalTask) {
        // A call to one of this layer's shared steps (owner, 2026-10-20): name
        // the step it shares and the values this call gives it.
        const given = Object.entries(n.inputs ?? {}).map(([k, v]) => `\`${k}\` = \`${v}\``);
        out.push(`- Shared step \`${n.globalTask.id}\`${given.length > 0 ? `, with ${given.join(", ")}` : ""}.`);
      }
      if (n.calledElement) {
        const given = Object.entries(n.inputs ?? {}).map(([k, v]) => `\`${k}\` = \`${v}\``);
        out.push(`- A subprocess (\`${n.calledElement}\`${given.length > 0 ? `, with ${given.join(", ")}` : ""}): \`workflow_next\` reports its own steps; complete those — this call activity itself is not completable.`);
      } else {
        out.push(`- Record it: \`workflow_complete\` with \`node: "${n.id}"\`.`);
      }
      out.push(`- ${nextLine(model, n)}`, "");
    } else if (n.kind === "boundary") {
      out.push(`### Optional, while ${ref(model, n.attachedTo ?? "")} is open — ${head}`, "");
      const d = firstSentence(n.documentation);
      if (d) out.push(`- ${d}`);
      out.push(
        `- Only if it happens: \`workflow_complete\` with \`node: "${n.id}"\` while ${ref(model, n.attachedTo ?? "")} is enabled. ` +
          "That step stays enabled and nothing waits for this path; skipping it is the default.",
      );
      out.push(`- ${nextLine(model, n)}`, "");
    } else if (n.kind === "exclusive" && n.outgoing.length > 1) {
      out.push(`### Decide — ${head}`, "");
      const d = firstSentence(n.documentation);
      if (d) out.push(`- ${d}`);
      if (n.decisionRef) {
        out.push(`- Computed by the DMN table \`${n.decisionRef}\`: call \`workflow_complete\` with \`node: "${n.id}"\` and the \`facts\` it reads — the table returns the branch; pass no \`outcome\`.`);
      } else {
        out.push(`- Call \`workflow_complete\` with \`node: "${n.id}"\` and \`outcome\` set to the label that holds:`);
      }
      for (const f of n.outgoing) {
        const flow = model.flows.get(f);
        if (!flow) continue;
        out.push(`  - ${flow.name ? `«${flow.name}»` : "(unlabelled branch)"} → ${ref(model, flow.to)}`);
      }
      out.push("");
    } else if (n.kind === "parallel" && n.outgoing.length > 1) {
      out.push(`### Do all of — ${head}`, "");
      out.push(`- Work every branch; none is optional. ${nextLine(model, n).replace("next: ", "Branches: ")}`);
      out.push("- The engine passes through this gateway itself; there is nothing to record here.", "");
    } else {
      // A converging gateway (exclusive merge or parallel join).
      out.push(`### ${n.kind === "parallel" ? "Wait for all" : "Merge"} — ${head}`, "");
      out.push(
        n.kind === "parallel"
          ? `- Continue only when every one of the ${n.incoming.length} incoming branches is done; the engine passes through itself.`
          : "- Nothing to do or decide: the paths meet here and the engine passes through.",
      );
      out.push(`- ${nextLine(model, n)}`, "");
    }
  }
  return out.join("\n").replace(/\n+$/, "\n");
}

/** Every `.bpmn` in every layer of the repository, by its declared knowledge-graph directories. */
export function bpmnSources(root: string = HARNESS_ROOT): string[] {
  const all = new Set<string>();
  for (const inst of layerRootsIn(repoRootFor(root))) for (const f of processDiagrams(workflowFiles(inst))) all.add(f);
  return [...all].sort();
}

/** Where the harness keeps the checklists of the layers below it (bootstrap, bootstrap-tools). */
export const defaultOutDir = (root: string = HARNESS_ROOT): string => join(root, siteDirFor(root), "assets", "workflows", "checklists");

/** One diagram's checklist: the file it is written to, and the source line it cites. */
export interface Placement {
  /** Absolute path of the `<stem>.checklist.md`. */
  out: string;
  /** `<instance>/<path within it>` — the same in an index and in the owner's repository. */
  label: string;
}

/**
 * Where each diagram's checklist is committed (see the module header): beside
 * the diagram in the layer that owns it, or, for a layer below the
 * harness, in the harness's `defaultOutDir`. `harnessRoot` is the harness
 * instance; a source outside every layer is labelled from the repository
 * root and kept beside its diagram.
 */
export function placementOf(sources: readonly string[], repoRoot: string, harnessRoot: string = HARNESS_ROOT): Map<string, Placement> {
  const instances = layerRootsIn(repoRoot)
    .map((root) => ({ root: resolve(root), decl: readDeclaration(root) }))
    .filter((i): i is { root: string; decl: NonNullable<typeof i.decl> } => i.decl?.name !== undefined)
    // Deepest first, so a nested layer owns its own files.
    .sort((a, b) => b.root.length - a.root.length);
  const needs = new Map(instances.map((i) => [i.decl.name!, (i.decl.needs ?? []) as readonly string[]] as const));
  const harness = readDeclaration(harnessRoot)?.name;
  const below = harness ? belowHarness(harness, needs) : new Set<string>();
  const out = new Map<string, Placement>();
  for (const src of sources) {
    const abs = resolve(src);
    const owner = instances.find((i) => abs === i.root || abs.startsWith(i.root + sep));
    const label = (owner ? `${owner.decl.name}/${relative(owner.root, abs)}` : relative(repoRoot, abs)).split("\\").join("/");
    const name = `${basename(abs, ".bpmn")}.checklist.md`;
    out.set(src, { out: owner && below.has(owner.decl.name!) ? join(defaultOutDir(harnessRoot), name) : join(dirname(abs), name), label });
  }
  return out;
}

/**
 * Render every diagram; returns `{ name, out, text }` per checklist, and the
 * diagrams that could not be loaded. `--out <dir>` puts them all in one
 * directory (`into`), where two diagrams with one stem would collide, and that
 * is refused rather than won by the last write.
 */
export async function renderAll(
  sources: readonly string[],
  repoRoot: string,
  opts: { into?: string; harnessRoot?: string } = {},
): Promise<{ files: { name: string; out: string; text: string }[]; failed: string[] }> {
  const files: { name: string; out: string; text: string }[] = [];
  const failed: string[] = [];
  const outs = new Set<string>();
  const placed = placementOf(sources, repoRoot, opts.harnessRoot);
  for (const src of sources) {
    let model: ProcessModel;
    try {
      model = await loadProcessModel(src);
    } catch (e) {
      failed.push(`${relative(repoRoot, src)}: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
      continue;
    }
    const p = placed.get(src)!;
    const name = basename(p.out);
    const out = opts.into ? join(opts.into, name) : p.out;
    if (outs.has(out)) {
      failed.push(`${relative(repoRoot, src)}: a second diagram named ${basename(src)} would overwrite ${relative(repoRoot, out)}`);
      continue;
    }
    outs.add(out);
    files.push({ name, out, text: checklistFor(model, p.label) });
  }
  return { files, failed };
}

/**
 * Committed checklists no diagram produces any more: every `*.checklist.md`
 * in a directory a checklist is written to, or a declared workflow directory
 * holds, that is not one of `wanted`.
 */
export function orphanChecklists(dirs: Iterable<string>, wanted: ReadonlySet<string>): string[] {
  const out = new Set<string>();
  const walk = (d: string): void => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".checklist.md") && !wanted.has(p)) out.add(p);
    }
  };
  for (const d of dirs) walk(d);
  return [...out].sort();
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  const oi = argv.indexOf("--out");
  const into = oi >= 0 ? resolve(argv[oi + 1]!) : undefined;
  const repoRoot = repoRootFor(HARNESS_ROOT);
  const sources = bpmnSources();
  if (sources.length === 0) {
    console.error("bpmn-checklist: no .bpmn sources found in any declared knowledge-graph directory — refusing to report a clean run over nothing");
    process.exit(2);
  }
  const { files, failed } = await renderAll(sources, repoRoot, { into });
  for (const f of failed) console.error(`? ${f}`);
  const shown = (p: string): string => relative(repoRoot, p);
  if (check) {
    // In a layer's PR checks, only checklists the caller commits (owner ruling 2026-11-05, "Move the checks", generator checks included; `lib/gate-own.ts`).
    const mine = (p: string) => gateOwnsFile(shown(p)) !== false;
    const stale = files.filter((f) => mine(f.out) && (!existsSync(f.out) || readFileSync(f.out, "utf8") !== f.text)).map((f) => f.out);
    const wanted = new Set(files.map((f) => f.out));
    // Every directory a checklist is written to, and every directory holding a
    // diagram: a diagram that was deleted or renamed leaves its checklist in a
    // directory the first set may no longer name.
    const dirs = new Set([...files.map((f) => dirname(f.out)), ...sources.map((s) => dirname(s)), ...(into ? [into] : [defaultOutDir()])]);
    const orphans = orphanChecklists(dirs, wanted).filter(mine);
    for (const s of stale) console.error(`✗ ${shown(s)} is stale or missing — run \`bun run cat bpmn:checklist\``);
    for (const o of orphans) console.error(`✗ ${shown(o)} has no diagram — remove it`);
    if (stale.length + orphans.length > 0) process.exit(1);
    if (failed.length > 0) process.exit(2);
    console.log(`✓ ${files.length} checklist(s) current, each beside its diagram or, below the harness, in ${shown(defaultOutDir())}`);
  } else {
    for (const f of files) {
      mkdirSync(dirname(f.out), { recursive: true });
      writeFileSync(f.out, f.text);
    }
    const byInstance = new Map<string, number>();
    for (const f of files) {
      const k = shown(f.out).split("/")[0]!;
      byInstance.set(k, (byInstance.get(k) ?? 0) + 1);
    }
    console.log(`bpmn-checklist: ${files.length} checklist(s) written (${[...byInstance].map(([k, n]) => `${k} ${n}`).join(", ")})${failed.length ? `; ${failed.length} diagram(s) could not be loaded` : ""}`);
    if (failed.length > 0) process.exit(2);
  }
}
