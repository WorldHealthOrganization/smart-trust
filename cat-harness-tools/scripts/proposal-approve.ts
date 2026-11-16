#!/usr/bin/env bun
/**
 * Approve a proposal, and seed the work plan that carries it out.
 *
 * @module scripts/proposal-approve
 *
 * Work item folio-assistant-exrp, plan step 4. Owner, 2026-11-05: *"Docs/proposals/
 * once approved become workplans"*; on the card, "Proposal seeds plan".
 *
 * One command writes BOTH ends, so neither is kept by hand:
 *
 * - the proposal's front matter gets `status: approved`, `approvedOn` and
 *   `plan: <id>` (`schemas/sdlc/work-plan.ts`, {@link PROPOSAL_APPROVED});
 * - the plan, a new epic or the one `--plan` names, gets a `process:` tag per
 *   `--process` and a `proposal:` tag naming the file.
 *
 * A plan is defined by the process it runs, so at least one `--process` is
 * required unless `--plan` names a work item that already has one.
 *
 * Usage:
 *   bun run cat proposal:approve <proposal.md> --process <bpmn:process id> [--process …]
 *                                [--plan <epic or milestone id>] [--parent <id>] [--dry-run]
 *   bun run cat proposal:approve --check <proposals dir>   # where proposals and plans disagree; reports, exits 0
 *
 * The proposal path is written as given, relative to the checkout root, and
 * is what the plan's `proposal:` tag holds.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { createBean, findBean, listBeans, setFieldInText } from "./beans-fallback.ts";
import {
  addTagsInText,
  PLAN_PROCESS_TAG,
  PLAN_PROPOSAL_TAG,
  PLAN_TYPES,
  PROPOSAL_APPROVED,
  proposalPlanFindings,
  workPlanOf,
  type WorkPlanFinding,
} from "../schemas/sdlc/work-plan.ts";

/** One front-matter scalar of a markdown file, or `undefined`. */
export function frontMatterValue(raw: string, key: string): string | undefined {
  const m = /^---\n([\s\S]*?)\n---/.exec(raw);
  if (!m) return undefined;
  const line = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(m[1]!);
  if (!line) return undefined;
  const v = line[1]!.trim().replace(/^["']|["']$/g, "");
  return v === "" || v === ">-" || v === "|" ? undefined : v;
}

/**
 * Set front-matter scalars of a proposal, keeping the rest of the file.
 * A proposal has no `updated_at`, so none is added (unlike a work item).
 */
export function setProposalFields(raw: string, fields: Record<string, string>): string {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!m) throw new Error("the proposal has no front matter: add `title:` and `kind: proposal` first");
  let front = m[1]!;
  for (const [k, v] of Object.entries(fields)) {
    const line = `${k}: ${v}`;
    front = new RegExp(`^${k}:.*$`, "m").test(front) ? front.replace(new RegExp(`^${k}:.*$`, "m"), line) : `${front}\n${line}`;
  }
  return `---\n${front}\n---\n${m[2]}`;
}

export interface ApproveOptions {
  /** The checkout root the proposal path and the store are read from. */
  root: string;
  /** The proposal's path, relative to `root`. */
  proposal: string;
  processes: readonly string[];
  plan?: string;
  parent?: string;
  /** The day written as `approvedOn`; today when absent. */
  on?: string;
  dryRun?: boolean;
}

export interface Approved {
  plan: string;
  created: boolean;
  proposal: string;
  tags: string[];
}

export function approveProposal(o: ApproveOptions): Approved {
  const proposalAbs = resolve(o.root, o.proposal);
  if (!existsSync(proposalAbs)) throw new Error(`no proposal at ${o.proposal}`);
  const path = relative(o.root, proposalAbs).split("\\").join("/");
  const raw = readFileSync(proposalAbs, "utf-8");
  const title = frontMatterValue(raw, "title");
  if (title === undefined) throw new Error(`${path} has no \`title:\` in its front matter`);

  const already = frontMatterValue(raw, "plan");
  if (frontMatterValue(raw, "status") === PROPOSAL_APPROVED && already !== undefined && o.plan === undefined) {
    throw new Error(`${path} is already approved, with plan ${already}; pass --plan ${already} to add processes to it`);
  }

  let planId = o.plan;
  let created = false;
  if (planId !== undefined) {
    const b = findBean(o.root, planId);
    if (!b) throw new Error(`no work item ${planId}`);
    if (!PLAN_TYPES.includes(b.type)) throw new Error(`${b.id} is a ${b.type}: a work plan is an epic or a milestone`);
    planId = b.id;
    if (o.processes.length === 0 && workPlanOf(readTags(b.path)) === undefined) {
      throw new Error(`${b.id} names no process yet: pass --process <bpmn:process id>`);
    }
  } else if (o.processes.length === 0) {
    throw new Error("a work plan is defined by the process it runs: pass --process <bpmn:process id>");
  }

  const tags = [...o.processes.map((p) => `${PLAN_PROCESS_TAG}${p}`), `${PLAN_PROPOSAL_TAG}${path}`];
  if (o.dryRun) return { plan: planId ?? "(new epic)", created: planId === undefined, proposal: path, tags };

  if (planId === undefined) {
    const { bean, duplicateOf } = createBean(o.root, {
      title,
      type: "epic",
      status: "todo",
      body: `The work plan of the proposal \`${path}\`, seeded when it was approved.`,
    });
    if (duplicateOf) throw new Error(`a work item titled "${title}" already exists (${duplicateOf.id}): pass --plan ${duplicateOf.id}`);
    planId = bean.id;
    created = true;
  }
  const b = findBean(o.root, planId)!;
  let text = addTagsInText(readFileSync(b.path, "utf-8"), tags);
  if (o.parent !== undefined) text = setFieldInText(text, "parent", o.parent);
  writeFileSync(b.path, text, "utf-8");

  const on = o.on ?? new Date().toISOString().slice(0, 10);
  writeFileSync(proposalAbs, setProposalFields(raw, { status: PROPOSAL_APPROVED, approvedOn: on, plan: planId }), "utf-8");
  return { plan: planId, created, proposal: path, tags };
}

function readTags(file: string): string[] {
  const m = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, "utf-8"));
  const seq = m && /^tags:[ \t]*\n((?:[ \t]+-[ \t]*\S.*(?:\n|$))+)/m.exec(m[1]!);
  return seq ? seq[1]!.split("\n").map((l) => l.replace(/^[ \t]*-[ \t]*/, "").trim()).filter(Boolean) : [];
}

/** Every proposal under `dir` against the store's plans: {@link proposalPlanFindings}. */
export function checkProposals(root: string, dir: string): { proposals: number; findings: WorkPlanFinding[] } {
  const abs = resolve(root, dir);
  const proposals = readdirSync(abs)
    .filter((n) => n.endsWith(".md") && n !== "README.md")
    .map((n) => {
      const raw = readFileSync(join(abs, n), "utf-8");
      const path = relative(root, join(abs, n)).split("\\").join("/");
      return { path, status: frontMatterValue(raw, "status"), plan: frontMatterValue(raw, "plan") };
    });
  const items = listBeans(root).map((b) => ({ id: b.id, tags: readTags(b.path) }));
  return { proposals: proposals.length, findings: proposalPlanFindings(proposals, items) };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const many = (name: string): string[] => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] ? [argv[i + 1]!] : []));
  const one = (name: string): string | undefined => many(name)[0];
  const checkDir = one("check");
  if (checkDir !== undefined) {
    const { proposals, findings } = checkProposals(resolve("."), checkDir);
    console.log(`${proposals} proposal(s) read under ${checkDir}; ${findings.length} disagree with their plan.`);
    for (const f of findings) console.log(`  - ${f.id} ${f.problem}`);
    process.exit(0);
  }
  const proposal = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1]!.startsWith("--") && argv[i - 1] !== "--dry-run"));
  if (!proposal) {
    console.error("usage: proposal:approve <proposal.md> --process <id> [--process …] [--plan <id>] [--parent <id>] [--dry-run]");
    process.exit(2);
  }
  try {
    const r = approveProposal({
      root: resolve("."),
      proposal,
      processes: many("process"),
      plan: one("plan"),
      parent: one("parent"),
      dryRun: argv.includes("--dry-run"),
    });
    console.log(
      `${argv.includes("--dry-run") ? "Would approve" : "Approved"} ${r.proposal}: plan ${r.plan}${r.created && !argv.includes("--dry-run") ? " (new epic)" : ""}, tags ${r.tags.join(", ")}.`,
    );
  } catch (e) {
    console.error(`proposal:approve: ${(e as Error).message}`);
    process.exit(1);
  }
}
