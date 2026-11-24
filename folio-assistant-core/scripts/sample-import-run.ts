#!/usr/bin/env bun
/**
 * Drive ONE run of `sample-import.bpmn` through the real workflow tools, doing
 * each step's work and recording what could not be done here.
 *
 * Usage:
 *   bun run folio-assistant-core/scripts/sample-import-run.ts \
 *     --root . --instance <catalogue-instance> --item item/<uuid> --subject <slug> [--bean <id>] [--bundles ORIGINAL,...]
 *
 * Bean `xlg2`: the diagram had never executed. This goes through
 * `workflow_start` and `workflow_complete` as registered — the same handlers the
 * MCP server exposes, captured from a stub server as `precondition-consumer`
 * does — so the committed instance is the tools' own record, with their gates,
 * not a JSON file written to look like one.
 *
 * ## Scope: a TRIAL of an item already held
 *
 * Owner, 2026-09-29: *"WPRO as a trial"*. A trial lands in `fsh-guts/` and is
 * never published or refreshed; `library/` is not touched, so the run cannot be
 * mistaken for the provenance of the library entry, which arrived by upload.
 *
 * ## What it refuses to pretend
 *
 * - **The fetch is not performed** where egress to the source is blocked. The
 *   step is completed with a note that says so, and the held bytes are used
 *   instead only after their recorded digest is RE-COMPUTED and matches.
 * - **The gates are not re-decided.** Each is read from the item's recorded
 *   materialization, with its basis quoted; anything short of `permitted`
 *   takes the diagram's "no, or unknown" branch.
 * - **A step this driver does not know stops the run.** A diagram edit that
 *   adds a step must fail here loudly rather than be completed blind.
 *
 * @module folio-assistant-core/scripts/sample-import-run
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { registerWorkflowTools } from "@litlfred/cat-harness-tools/src/tools/workflow.ts";
import { fshGutsDirectory } from "@litlfred/cat-harness-tools/schemas/kg/fsh-guts.ts";
import { contentAt } from "@litlfred/cat-harness-tools/scripts/branch-store.ts";
import { positionOf } from "@litlfred/cat-harness-tools/src/workflow/instance.ts";
import { WORKFLOW_DIR, instanceId, loadInstance } from "@litlfred/cat-harness-tools/src/workflow/store.ts";
import { CatalogueNodeSchema, type CatalogueNode } from "../schemas/catalogue.js";
import { PUBLICATION_GATES } from "../schemas/materialization.js";
import { checkSampleImport, describeImportCheck } from "./sample-import-check.ts";
import { probeLiveness, type Fetcher } from "./source-liveness.ts";
import { resolvableIri } from "../schemas/catalogue.js";

export type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }>;

export interface RunOptions {
  /** The repository root: where `beans/workflows/` and `fsh-guts/` live. */
  root: string;
  /** The layer directory holding the store, relative to `root`, e.g. an IRIS mirror's directory. */
  instance: string;
  item: string;
  subject: string;
  bean?: string;
  actor?: string;
  /**
   * The SUBSET `Task_Enumerate` takes: bundles to sample, e.g. `["ORIGINAL"]`.
   * Absent means every bitstream of the item, derived renderings included.
   */
  bundles?: string[];
  /** Says whether egress to `host` is available. Default: never — this environment's rule. */
  canFetch?: (host: string) => boolean;
  /**
   * The workflow tools to drive. Default: the REAL registered handlers, with
   * their GitHub-vouched authorization — what a recorded run must go through.
   * A test injects handlers over the same engine (`startInstance` /
   * `complete`) because a temp root has no GitHub identity to authorize.
   */
  tools?: Map<string, Handler>;
  /**
   * The liveness probe's network call (bean `08u4`). Default: the real one.
   * A test injects a refusing fetcher so the verdict is could-not-determine
   * without touching the network.
   */
  livenessFetcher?: Fetcher;
}

export interface RunResult {
  instanceId: string;
  instancePath: string;
  trialPath?: string;
  steps: { node: string; outcome?: string; note: string }[];
  status: string;
}

const PROCESS_ID = "Process_SampleImport";

function loadItem(instanceRoot: string, item: string): CatalogueNode {
  const dir = join(instanceRoot, "catalogue", "nodes");
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    if (!f.endsWith(".json")) continue;
    const raw = JSON.parse(readFileSync(join(dir, f), "utf-8")) as { id?: string };
    if (raw.id === item) return CatalogueNodeSchema.parse(raw);
  }
  throw new Error(`${item} is not a node of ${instanceRoot}/catalogue — nothing to scope`);
}

/** The recorded verdict and basis of one gate, across the item's held bitstreams. */
function gateNote(node: CatalogueNode, gate: string): { permitted: boolean; text: string } {
  const lines: string[] = [];
  let permitted = true;
  for (const b of node.bitstreams) {
    const g = (b.materialization?.gates as Record<string, { verdict?: string; basis?: string }> | undefined)?.[gate];
    const verdict = g?.verdict ?? "unknown";
    if (verdict !== "permitted") permitted = false;
    lines.push(`${b.name}: ${verdict} — ${g?.basis ?? "no basis recorded"}`);
  }
  return { permitted, text: `READ from the recorded materialization, not re-decided. ${lines.join(" | ")}` };
}

/** One gate's verdict over every bitstream: `permitted` only when each one is; otherwise `refused` if any is, else `unknown`. */
function gateVerdict(node: CatalogueNode, gate: string): "permitted" | "refused" | "unknown" {
  const vs = node.bitstreams.map(
    (b) => (b.materialization?.gates as Record<string, { verdict?: string }> | undefined)?.[gate]?.verdict ?? "unknown",
  );
  if (vs.length > 0 && vs.every((v) => v === "permitted")) return "permitted";
  return vs.includes("refused") ? "refused" : "unknown";
}

const GATES = ["size", "restrictions", "copyright", "retention", "sourceLoss"] as const;

export async function runSampleImport(opts: RunOptions): Promise<RunResult> {
  const root = resolve(opts.root);
  const instanceRoot = join(root, opts.instance);
  const whole = loadItem(instanceRoot, opts.item);
  const node: CatalogueNode = opts.bundles
    ? { ...whole, bitstreams: whole.bitstreams.filter((b) => opts.bundles!.includes(b.bundle)) }
    : whole;
  const actor = opts.actor ?? "claude";
  const canFetch = opts.canFetch ?? (() => false);

  const tools = opts.tools ?? new Map<string, Handler>();
  if (!opts.tools) {
    registerWorkflowTools({ tool: (n: string, _d: string, _s: unknown, fn: Handler) => tools.set(n, fn) } as never, root);
  }
  const call = (name: string, args: Record<string, unknown>) => {
    const h = tools.get(name);
    if (!h) throw new Error(`${name} is not registered`);
    return h(args);
  };

  await call("workflow_start", { process: "sample-import", subject: opts.subject, bean: opts.bean });
  const id = instanceId(PROCESS_ID, opts.subject);
  const steps: RunResult["steps"] = [];
  let trialPath: string | undefined;
  let gatesOk = true;
  let passed = false;

  const originals = node.bitstreams.filter((b) => b.bundle === "ORIGINAL");

  for (let guard = 0; guard < 40; guard++) {
    const state = loadInstance(root, id);
    if (!state) throw new Error(`instance ${id} vanished`);
    if (state.status !== "running") break;
    const here = positionOf(state).at(-1)?.split(" ▸ ").at(-1);
    if (!here) break;
    let outcome: string | undefined;
    let facts: Record<string, unknown> | undefined;
    let computed: string | undefined; // a computed gateway's branch, for the run's own record
    let note: string;

    switch (here) {
      case "Task_Scope":
        note =
          `WHICH ITEMS: ${opts.item} ("${node.title}"). ` +
          `WHICH STORE: ${opts.instance}/catalogue — folio-catalogue-node/v1 nodes with folio-dublin-core/v1 records. ` +
          `PERMANENT: no — a TRIAL (owner, 2026-09-29: "WPRO as a trial"); it lands in fsh-guts/ and library/ is untouched.`;
        break;
      case "Task_Purpose":
        note = "working — a trial of the import, not an archival copy.";
        break;
      case "Task_Enumerate":
        note =
          `${whole.bitstreams.length} bitstream(s) in the item; SUBSET ` +
          (opts.bundles ? `to bundle(s) ${opts.bundles.join(", ")}` : "none — every bitstream is sampled") +
          `: ${node.bitstreams.map((b) => `${b.name} (${b.bundle}, ${b.bytes ?? "?"} bytes)`).join("; ")}.`;
        break;
      case "Task_Size": {
        const g = gateNote(node, "size");
        if (!g.permitted) gatesOk = false;
        note = g.text;
        break;
      }
      case "Task_AnswerGates": {
        // The other four gates, answered in one step (shared block G10).
        const parts: string[] = [];
        for (const gate of ["restrictions", "copyright", "retention", "sourceLoss"]) {
          const g = gateNote(node, gate);
          if (!g.permitted) gatesOk = false;
          parts.push(`${gate}: ${g.text.replace(/^READ from the recorded materialization, not re-decided\. /, "")}`);
        }
        note = `READ from the recorded materialization, not re-decided. ${parts.join(" || ")}`;
        break;
      }
      case "Gateway_Gates":
        // Computed by materialization-gate.dmn from the five verdicts, never chosen here.
        facts = Object.fromEntries(GATES.map((g) => [g, gateVerdict(node, g)]));
        computed = gatesOk ? "yes" : "no, or unknown";
        note = gatesOk
          ? `every gate reads permitted on every bitstream (publication gates ${PUBLICATION_GATES.join(", ")} included)`
          : "at least one gate is not permitted — the diagram's refusal branch";
        break;
      case "Task_Fetch": {
        const parts: string[] = [];
        // Bean `08u4`: is the source still THERE? Asked of the resolvable IRI
        // (the Handle first) before anything is fetched or substituted, and
        // recorded whatever the answer — could-not-determine included.
        const iri = resolvableIri(whole);
        if (iri) {
          const l = await probeLiveness(iri, opts.livenessFetcher);
          parts.push(`LIVENESS of ${iri}: ${l.liveness} (${l.basis}).`);
        } else {
          parts.push("LIVENESS: could-not-determine — the item names no resolvable IRI.");
        }
        for (const b of originals) {
          const up = (b.materialization?.provenance as { upstream?: string } | undefined)?.upstream;
          const host = up ? new URL(up).host : "(no upstream)";
          const m = b.materialization;
          const held = m?.localPath ? join(instanceRoot, m.localPath) : undefined;
          if (canFetch(host)) {
            throw new Error(`fetching ${up} is not implemented — a run where egress works needs a fetcher, not a silent substitute`);
          }
          if (!held || !existsSync(held) || !m?.fixity) {
            throw new Error(`${b.name}: cannot fetch (${host} blocked) and no held bytes with fixity to substitute`);
          }
          const got = createHash(m.fixity.algorithm).update(readFileSync(held)).digest("hex");
          if (got !== m.fixity.digest) throw new Error(`${b.name}: held bytes do not match the recorded ${m.fixity.algorithm}`);
          parts.push(
            `NOT PERFORMED HERE: egress to ${host} is blocked in this environment. ` +
              `SUBSTITUTED: the bytes already held at ${relative(root, held)}, ${m.fixity.algorithm} re-computed and matching ${m.fixity.digest}.`,
          );
        }
        note = parts.join(" ");
        break;
      }
      case "Task_Declare":
        note =
          `The materialization (purpose, gates, fixity) is already recorded on ${opts.item} in ${opts.instance}/catalogue; ` +
          `nothing is re-declared, because re-writing it would claim this run as its provenance.`;
        break;
      case "Gateway_Materialized": {
        // Answered from how the materialize subprocess ACTUALLY ended, never
        // assumed: a hard-coded "yes" here once recorded an import the gates
        // had refused (first run, 2026-09-29).
        const child = Object.values(state.children ?? {}).find((c) => c.processId === "Process_MaterializeRemote");
        const refused = child?.history.some((h) => h.node === "EndEvent_Refused") ?? true;
        outcome = refused || !gatesOk ? "no, or unknown" : "yes";
        note = refused
          ? "materialize-remote ended at EndEvent_Refused — the sample was not materialized"
          : "materialize-remote completed; the sample's bytes are present and their fixity verified";
        break;
      }
      case "Gateway_Permanent":
        outcome = "trial";
        note = "trial, per the scope";
        break;
      case "Task_Trial": {
        // Through the declaration, never `fsh-guts/` spelled (bean 9c7h). Once
        // the trashcan is kept on its branch, a trial written to an unmounted
        // path would land in no store at all, so refuse rather than write it.
        const kept = contentAt("fsh-guts", root);
        if (kept.state === "not-mounted") throw new Error(`sample-import trial: ${kept.reason}`);
        const dir = join(fshGutsDirectory(root), "samples");
        mkdirSync(dir, { recursive: true });
        trialPath = join(dir, `${opts.subject}.md`);
        const check = checkSampleImport(instanceRoot, [opts.item]);
        writeFileSync(
          trialPath,
          [
            "---",
            "$schema: folio-fsh-guts/v1",
            `title: "Sample-import trial: ${node.title.replace(/"/g, "'")}"`,
            "kind: sample-import-trial",
            ...(opts.bean ? [`bean: ${opts.bean}`] : []),
            `summary: >-\n  One trial run of sample-import.bpmn over ${opts.item} in ${opts.instance}/catalogue, recorded as instance ${id}.` +
              ` A trial is kept and never published or refreshed. The bytes are NOT copied here: they are the held copy the` +
              ` catalogue already names, and duplicating them would add a second copy with no second source.`,
            "---",
            "",
            `# Sample-import trial — ${node.title}`,
            "",
            // Kept in the body, not the front matter: the fsh-guts JSON-LD
            // export maps only declared node fields, and an unmapped key is an
            // "invalid property" warning on expansion.
            `- **instance:** \`${id}\``,
            `- **item:** \`${opts.item}\``,
            `- **store:** \`${opts.instance}/catalogue\``,
            "",
            "The import test's result at landing, as `sample-import-check.ts` printed it:",
            "",
            "```",
            describeImportCheck(check),
            "```",
            "",
          ].join("\n"),
        );
        note = `landed as a trial at ${relative(root, trialPath)} (folio-fsh-guts/v1, kind sample-import-trial); library/ untouched`;
        break;
      }
      case "Task_ImportTest": {
        const check = checkSampleImport(instanceRoot, [opts.item]);
        passed = check.passed;
        note = check.checks.map((c) => `${c.name}: ${c.verdict} (${c.evidence.join("; ")})`).join(" · ");
        break;
      }
      case "Gateway_Passed":
        outcome = passed ? "yes" : "no, or could not run";
        note = passed ? "all four checks passed" : "a check failed or could not run";
        break;
      case "Task_StayRef": {
        const held = [...GATES]
          .map((g) => ({ g, n: gateNote(node, g) }))
          .filter((x) => !x.n.permitted)
          .map((x) => `${x.g}: ${x.n.text.replace(/^READ from the recorded materialization, not re-decided\. /, "")}`);
        note = `left referenced: not every gate reads permitted. ${held.join(" || ")}`;
        break;
      }
      case "Task_RecordFindings":
        note = "findings are the failed checks recorded on Task_ImportTest above; the landed copy is kept as evidence";
        break;
      default:
        throw new Error(
          `sample-import reached ${here}, a step this driver does not know. The diagram changed; ` +
            `teach the driver the step rather than completing it blind.`,
        );
    }

    await call("workflow_complete", { instance: id, node: here, outcome, facts, actor, note, target: opts.item });
    steps.push({ node: here, outcome: outcome ?? computed, note });
  }

  const final = loadInstance(root, id)!;
  return {
    instanceId: id,
    instancePath: join(root, WORKFLOW_DIR, `${id}.json`), // the store's own constant, not a second spelling (bean `gz47`)
    trialPath,
    steps,
    status: final.status,
  };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const root = arg("root") ?? ".";
  const instance = arg("instance");
  const item = arg("item");
  const subject = arg("subject");
  if (!instance || !item || !subject) {
    console.error("usage: sample-import-run.ts --root <repo> --instance <dir> --item <id> --subject <slug> [--bean <id>]");
    process.exit(2);
  }
  const bundles = arg("bundles")?.split(",").filter(Boolean);
  const r = await runSampleImport({ root, instance, item, subject, bean: arg("bean"), bundles });
  for (const s of r.steps) console.log(`• ${s.node}${s.outcome ? ` → ${s.outcome}` : ""}\n    ${s.note}`);
  console.log(`\ninstance ${r.instanceId}: ${r.status}\n  ${r.instancePath}${r.trialPath ? `\n  trial: ${r.trialPath}` : ""}`);
  process.exit(r.status === "completed" ? 0 : 1);
}
