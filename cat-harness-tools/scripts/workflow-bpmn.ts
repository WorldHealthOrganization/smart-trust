/**
 * Which BPMN diagram a GitHub workflow implements, and which node each of its
 * jobs is — read from the WORKFLOW.
 *
 * A workflow depends on the process it carries out, so the workflow holds the
 * pointer and the diagram names none of its implementations.
 *
 * Two comment lines, because YAML has no other place a GitHub workflow will
 * accept an unknown key:
 *
 * ```yaml
 * # bpmn: cat-harness/sdlc/processes/ci-health-watch.bpmn
 * jobs:
 *   report:
 *     # bpmn-node: Start_Sweep
 * ```
 *
 * - `# bpmn: <path>` at column 0 — the diagram, repository-relative, because
 *   `.github/workflows/` sits at the repository root and a path has one
 *   spelling from there. More than one line is allowed and each is read.
 * - `# bpmn-node: <id>` INSIDE a job — indented deeper than the job's key,
 *   before the next job. A comment above a job key is prose about that job,
 *   not attributed to it by proximity: containment is the rule.
 *
 * A comment is read line by line, not by the YAML parser (which drops it).
 * That is sound here because both lines are anchored: column 0, or inside the
 * `jobs:` block under a two-space job key — the shape every workflow here has.
 *
 * @module scripts/workflow-bpmn
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface WorkflowBpmn {
  /** Repository-relative diagrams, from `# bpmn:` lines, in file order. */
  diagrams: string[];
  /** Each `# bpmn-node:` inside a job, with the job that contains it. */
  nodes: { job: string; node: string }[];
}

const HEADER = /^#\s*bpmn:\s*(\S+)\s*$/;
const NODE = /^\s{3,}#\s*bpmn-node:\s*(\S+)\s*$/;
const JOB_KEY = /^ {2}([A-Za-z0-9_-]+):\s*(#.*)?$/;

/** The diagram declarations one workflow makes. */
export function workflowBpmn(yaml: string): WorkflowBpmn {
  const out: WorkflowBpmn = { diagrams: [], nodes: [] };
  let inJobs = false;
  let job: string | undefined;
  for (const line of yaml.split(/\r?\n/)) {
    const h = HEADER.exec(line);
    if (h) {
      out.diagrams.push(h[1]!);
      continue;
    }
    if (/^\S/.test(line) && !line.startsWith("#")) {
      inJobs = /^jobs:\s*(#.*)?$/.test(line);
      job = undefined;
      continue;
    }
    if (!inJobs) continue;
    const k = JOB_KEY.exec(line);
    if (k) {
      job = k[1]!;
      continue;
    }
    const n = NODE.exec(line);
    if (n && job !== undefined) out.nodes.push({ job, node: n[1]! });
  }
  return out;
}

/** The `id`s of every BPMN element in a diagram — what a `# bpmn-node:` may name. */
export function bpmnIds(xml: string): Set<string> {
  return new Set([...xml.matchAll(/<bpmn:[A-Za-z]+\b[^>]*\sid="([^"]+)"/g)].map((m) => m[1]!));
}

/** Repository-relative workflow files, sorted. */
export function workflowPaths(repo: string): string[] {
  const dir = join(repo, ".github", "workflows");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort()
    .map((f) => `.github/workflows/${f}`);
}

/**
 * Every workflow that names `diagram` (repository-relative) — the inverse the
 * diagram no longer carries. A workflow that cannot be read names nothing.
 */
export function workflowsImplementing(repo: string, diagram: string): string[] {
  return workflowPaths(repo).filter((w) => {
    try {
      return workflowBpmn(readFileSync(join(repo, w), "utf-8")).diagrams.includes(diagram);
    } catch {
      return false;
    }
  });
}
